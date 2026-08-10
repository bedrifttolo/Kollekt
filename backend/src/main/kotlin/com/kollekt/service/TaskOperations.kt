package com.kollekt.service

import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.api.dto.TaskDto
import com.kollekt.api.dto.TaskFeedbackDto
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskFeedback
import com.kollekt.domain.TaskHistoryEntry
import com.kollekt.domain.TaskItem
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskFeedbackRepository
import com.kollekt.repository.TaskHistoryRepository
import com.kollekt.repository.TaskRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets.UTF_8
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import java.util.UUID

@Service
class TaskOperations(
    private val taskRepository: TaskRepository,
    private val memberRepository: MemberRepository,
    private val taskFeedbackRepository: TaskFeedbackRepository,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val notificationService: NotificationService,
    private val collectiveAccessService: CollectiveAccessService,
    private val taskHistoryRepository: TaskHistoryRepository,
    private val imageSafetyService: ImageSafetyService,
) {
    private companion object {
        const val XP_PER_LEVEL = 200
    }

    // Arbitrary Monday used as the zero point for the weekly task rotation. Only week-to-week
    // differences matter; this anchor keeps every collective rotating in lockstep.
    private val rotationEpoch: LocalDate = LocalDate.of(2024, 1, 1)

    fun notifyUpcomingTaskDeadlines(reminderDaysBeforeDue: Long = 1L) {
        val reminderDate = LocalDate.now().plusDays(reminderDaysBeforeDue)
        val tasksDueSoon =
            taskRepository
                .findAll()
                .filter { !it.completed && it.dueDate == reminderDate }

        for (task in tasksDueSoon) {
            realtimeUpdateService.publish(
                task.collectiveCode ?: "",
                "TASK_DEADLINE_SOON",
                mapOf(
                    "assignee" to task.assignee,
                    "taskId" to task.id,
                    "title" to task.title,
                    "dueDate" to task.dueDate.toString(),
                ),
            )
            notificationService.createParameterizedNotification(
                userName = task.assignee,
                type = "TASK_DEADLINE_SOON",
                params = mapOf("title" to task.title, "days" to reminderDaysBeforeDue.toString()),
            )
        }
    }

    @Transactional
    fun deleteExpiredTasks() {
        val completedCutoff = LocalDateTime.now().minusDays(7)
        val fallbackDueDateCutoff = LocalDate.now().minusDays(7)
        val expiredTasks =
            taskRepository
                .findAll()
                .filter {
                    it.completed &&
                        (
                            it.completedAt?.isBefore(completedCutoff)
                                ?: it.dueDate.isBefore(fallbackDueDateCutoff)
                        )
                }

        if (expiredTasks.isNotEmpty()) {
            // Archive stat-relevant facts before pruning the row so XP, achievements and
            // fairness keep their history. Member.xp already holds lifetime XP and is untouched.
            taskHistoryRepository.saveAll(expiredTasks.map { it.toHistoryEntry() })
            taskRepository.deleteAll(expiredTasks)
        }
    }

    private fun TaskItem.toHistoryEntry() =
        TaskHistoryEntry(
            collectiveCode = collectiveCode,
            assignee = assignee,
            completedBy = completedBy,
            dueDate = dueDate,
            category = category,
            completed = completed,
            completedAt = completedAt,
            xp = xp,
            penaltyXp = penaltyXp,
            recurrenceRule = recurrenceRule,
            originalTaskId = id,
        )

    fun getTasks(memberName: String): List<TaskDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val tasks =
            taskRepository
                .findAllByCollectiveCode(collectiveCode)
                .sortedWith(compareBy<TaskItem> { it.dueDate }.thenBy { it.id })
        val feedbackByTask =
            taskFeedbackRepository
                .findAllByTaskIdIn(tasks.map { it.id })
                .groupBy { it.taskId }
        return tasks.map { it.toDto(feedbackByTask[it.id].orEmpty()) }
    }

    @Transactional
    fun createTask(
        request: CreateTaskRequest,
        actorName: String,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val title = request.title.trim()
        require(title.isNotBlank()) { "Task title is required" }
        require(request.xp in 1..1000) { "Task XP must be between 1 and 1000" }

        if (memberRepository.findByNameAndCollectiveCode(request.assignee, collectiveCode) == null) {
            throw IllegalArgumentException("Assignee '${request.assignee}' is not in your collective")
        }

        val normalizedRule = normalizeRecurrenceRule(request.recurrenceRule)
        val initiallySaved =
            taskRepository.save(
                TaskItem(
                    title = title,
                    assignee = request.assignee,
                    collectiveCode = collectiveCode,
                    dueDate = request.dueDate,
                    category = request.category,
                    xp = request.xp,
                    recurrenceRule = normalizedRule,
                    recurrenceSeriesId = if (isRecurringTask(normalizedRule)) UUID.randomUUID().toString() else null,
                    recurrenceAnchorDate = if (isRecurringTask(normalizedRule)) request.dueDate else null,
                    recurring = isRecurringTask(normalizedRule),
                ),
            )

        val saved =
            if (isRecurringTask(normalizedRule)) {
                rebalanceFutureRecurringTasks(collectiveCode).firstOrNull { it.id == initiallySaved.id } ?: initiallySaved
            } else {
                initiallySaved
            }

        notificationService.createTaskAssignedNotification(saved.assignee, title)
        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "TASK_CREATED", dto)
        return dto
    }

    @Transactional
    fun deleteTask(
        taskId: Long,
        memberName: String,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
            ?: throw IllegalArgumentException("Task $taskId not found")

        taskRepository.deleteById(taskId)
        val payload = mapOf("id" to taskId)
        realtimeUpdateService.publish(collectiveCode, "TASK_DELETED", payload)
    }

    @Transactional
    fun giveTaskFeedback(
        taskId: Long,
        memberName: String,
        message: String,
        anonymous: Boolean,
        imageData: String?,
        imageMimeType: String?,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")

        if (imageData != null) {
            imageSafetyService.validateAndModerateBase64(imageData, imageMimeType.orEmpty())
        }

        taskFeedbackRepository.save(
            TaskFeedback(
                taskId = taskId,
                author = memberName,
                message = message,
                anonymous = anonymous,
                imageData = imageData,
                imageMimeType = imageMimeType,
            ),
        )

        if (task.assignee != memberName) {
            notificationService.createParameterizedNotification(
                userName = task.assignee,
                type = "TASK_FEEDBACK",
                params = mapOf("author" to (if (anonymous) "Someone" else memberName), "title" to task.title),
            )
        }

        val feedbacks = taskFeedbackRepository.findAllByTaskId(taskId)
        val dto = task.toDto(feedbacks)
        realtimeUpdateService.publish(collectiveCode, "TASK_FEEDBACK_UPDATED", dto)
        return dto
    }

    @Transactional
    fun updateTask(
        taskId: Long,
        updates: Map<String, Any>,
        memberName: String,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")

        val newTitle = updates["title"] as? String ?: task.title
        val newAssignee = updates["assignee"] as? String ?: task.assignee
        val newDueDate = (updates["dueDate"] as? String)?.let(LocalDate::parse) ?: task.dueDate
        val newCategory =
            (updates["category"] as? String)?.let {
                try {
                    TaskCategory.valueOf(it.uppercase())
                } catch (_: Exception) {
                    task.category
                }
            } ?: task.category
        val newXp = (updates["xp"] as? Number)?.toInt() ?: task.xp
        val recurringExplicit = updates["recurring"] as? Boolean
        val recurrenceRuleExplicit = updates["recurrenceRule"] as? String
        val newRecurrenceRule =
            when {
                recurrenceRuleExplicit != null -> normalizeRecurrenceRule(recurrenceRuleExplicit)
                recurringExplicit == false -> null
                recurringExplicit == true -> normalizeRecurrenceRule(task.recurrenceRule, recurringFallback = true)
                else -> normalizeRecurrenceRule(task.recurrenceRule)
            }
        val newRecurring = isRecurringTask(newRecurrenceRule)
        val newRecurrenceSeriesId =
            when {
                !newRecurring -> null
                task.recurrenceSeriesId != null -> task.recurrenceSeriesId
                else -> UUID.randomUUID().toString()
            }
        val newRecurrenceAnchorDate =
            when {
                !newRecurring -> null
                task.recurrenceAnchorDate != null -> task.recurrenceAnchorDate
                task.recurrenceSeriesId != null -> task.dueDate
                else -> newDueDate
            }

        if (memberRepository.findByNameAndCollectiveCode(newAssignee, collectiveCode) == null) {
            throw IllegalArgumentException("Assignee '$newAssignee' is not in your collective")
        }

        val initiallySaved =
            taskRepository.save(
                task.copy(
                    title = newTitle,
                    assignee = newAssignee,
                    dueDate = newDueDate,
                    category = newCategory,
                    xp = newXp,
                    recurrenceRule = newRecurrenceRule,
                    recurrenceSeriesId = newRecurrenceSeriesId,
                    recurrenceAnchorDate = newRecurrenceAnchorDate,
                    recurring = newRecurring,
                ),
            )
        val saved =
            if (newRecurring) {
                rebalanceFutureRecurringTasks(collectiveCode).firstOrNull { it.id == initiallySaved.id } ?: initiallySaved
            } else {
                initiallySaved
            }

        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "TASK_UPDATED", dto)
        return dto
    }

    @Transactional
    fun toggleTask(
        taskId: Long,
        memberName: String,
        completionImageData: String? = null,
        completionImageMime: String? = null,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")

        if (completionImageData != null) {
            imageSafetyService.validateAndModerateBase64(completionImageData, completionImageMime.orEmpty())
        }

        val completionXp = calculateCompletionAwardXp(task)
        val awardedXp = if (!task.completed && !task.xpAwarded) completionXp else 0

        if (awardedXp > 0) {
            val assignee =
                memberRepository.findByNameAndCollectiveCode(task.assignee, collectiveCode)
                    ?: throw IllegalArgumentException("Task assignee '${task.assignee}' not found in collective")

            val updatedXp = assignee.xp + awardedXp
            val updatedLevel = levelForXp(updatedXp)
            memberRepository.save(assignee.copy(xp = updatedXp, level = updatedLevel))
        }

        val saved =
            if (!task.completed) {
                taskRepository.save(
                    task.copy(
                        completed = true,
                        xpAwarded = true,
                        completedBy = memberName,
                        completedAt = LocalDateTime.now(),
                        completionImageData = completionImageData ?: task.completionImageData,
                        completionImageMime = completionImageMime ?: task.completionImageMime,
                    ),
                )
            } else {
                taskRepository.save(
                    task.copy(
                        completed = false,
                        completedBy = null,
                        completedAt = null,
                        xpAwarded = task.xpAwarded,
                        completionImageData = null,
                        completionImageMime = null,
                    ),
                )
            }

        val dto = saved.toDto()
        realtimeUpdateService.publish(
            collectiveCode,
            "TASK_UPDATED",
            mapOf(
                "task" to dto,
                "awardedXp" to awardedXp,
                "updatedBy" to memberName,
            ),
        )

        if (awardedXp > 0) {
            val updatedMember = memberRepository.findByNameAndCollectiveCode(task.assignee, collectiveCode)
            realtimeUpdateService.publish(
                collectiveCode,
                "XP_UPDATED",
                mapOf(
                    "memberName" to task.assignee,
                    "awardedXp" to awardedXp,
                    "totalXp" to (updatedMember?.xp ?: 0),
                    "level" to (updatedMember?.level ?: 1),
                    "taskId" to taskId,
                ),
            )
        }

        return dto
    }

    @Transactional
    fun regretTask(
        taskId: Long,
        memberName: String,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")
        if (task.completed) throw IllegalStateException("Task already completed")

        val awardedXp =
            if (!task.xpAwarded && memberName == task.assignee) calculateLateCompletionXp(task.xp) else 0

        if (awardedXp > 0) {
            val member =
                memberRepository.findByNameAndCollectiveCode(memberName, collectiveCode)
                    ?: throw IllegalArgumentException("User '$memberName' not found in collective")

            val updatedXp = member.xp + awardedXp
            val updatedLevel = levelForXp(updatedXp)
            memberRepository.save(member.copy(xp = updatedXp, level = updatedLevel))
        }

        val saved =
            taskRepository.save(
                task.copy(
                    completed = true,
                    completedBy = memberName,
                    completedAt = LocalDateTime.now(),
                    xpAwarded = (memberName == task.assignee),
                ),
            )

        notificationService.createParameterizedNotification(
            userName = memberName,
            type = "TASK_COMPLETED_LATE",
            params = mapOf("title" to task.title),
        )

        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "TASK_COMPLETED_LATE", dto)
        return dto
    }

    @Transactional
    fun penalizeMissedTasks() {
        val today = LocalDate.now()
        val overdueTasks =
            taskRepository
                .findAll()
                .filter { !it.completed && it.dueDate.isBefore(today) }

        for (task in overdueTasks) {
            val collectiveCode = task.collectiveCode ?: ""
            val member = memberRepository.findByNameAndCollectiveCode(task.assignee, collectiveCode)
            if (member != null && member.status == MemberStatus.ACTIVE) {
                val penalty = calculatePenaltyXp(task)
                if (task.penaltyXp == 0) {
                    memberRepository.save(member.copy(xp = member.xp + penalty))
                    taskRepository.save(task.copy(penaltyXp = penalty))
                    realtimeUpdateService.publish(
                        collectiveCode,
                        "TASK_PENALTY_APPLIED",
                        mapOf(
                            "assignee" to task.assignee,
                            "taskId" to task.id,
                            "title" to task.title,
                            "dueDate" to task.dueDate.toString(),
                            "penaltyXp" to penalty,
                            "lateApprovalAvailable" to true,
                        ),
                    )
                    notificationService.createParameterizedNotification(
                        userName = task.assignee,
                        type = "TASK_OVERDUE",
                        params = mapOf("title" to task.title),
                    )
                    val activeMembers =
                        memberRepository
                            .findAllByCollectiveCode(collectiveCode)
                            .filter { it.status == MemberStatus.ACTIVE && it.name != task.assignee }
                            .map { it.name }
                    if (activeMembers.isNotEmpty()) {
                        notificationService.createParameterizedGroupNotification(
                            userNames = activeMembers,
                            type = "TASK_OVERDUE_GROUP",
                            params = mapOf("title" to task.title, "assignee" to task.assignee),
                        )
                    }
                } else if (task.penaltyXp != penalty) {
                    val diff = penalty - task.penaltyXp
                    memberRepository.save(member.copy(xp = member.xp + diff))
                    taskRepository.save(task.copy(penaltyXp = penalty))
                }
            }
        }
    }

    @Transactional
    fun regretMissedTask(
        taskId: Long,
        memberName: String,
    ): TaskDto {
        val task =
            taskRepository.findById(taskId).orElse(null)
                ?: throw IllegalArgumentException("Task $taskId not found")
        if (task.assignee != memberName) throw IllegalArgumentException("Not your task")
        if (task.completed) throw IllegalArgumentException("Task already marked as completed")
        if (task.penaltyXp == 0) throw IllegalArgumentException("No penalty to regret")

        val collectiveCode = task.collectiveCode ?: ""
        val member =
            memberRepository.findByNameAndCollectiveCode(memberName, collectiveCode)
                ?: throw IllegalArgumentException("User '$memberName' not found in collective")
        val halfXp = calculateLateCompletionXp(task.xp)

        memberRepository.save(member.copy(xp = member.xp - task.penaltyXp + halfXp))
        val saved =
            taskRepository.save(
                task.copy(
                    completed = true,
                    completedBy = memberName,
                    completedAt = LocalDateTime.now(),
                    penaltyXp = 0,
                    xpAwarded = true,
                ),
            )

        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "TASK_REGRET", dto)
        return dto
    }

    @Transactional
    fun regenerateRecurringTasksForCollective(collectiveCode: String) {
        val members =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.status == MemberStatus.ACTIVE }
        if (members.isEmpty()) return

        val today = LocalDate.now()
        val allRecurringTasks =
            taskRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { isRecurringTask(it.recurrenceRule) }
        val groupedTasks = allRecurringTasks.groupBy(::recurrenceSeriesKey)

        data class TaskTemplate(
            val recurrenceSeriesId: String,
            val title: String,
            val recurrenceRule: String,
            val category: TaskCategory,
            val xp: Int,
            val anchorDate: LocalDate,
            val nextDueDate: LocalDate,
            val lastAssignee: String?,
        )

        val tasksToAssign = mutableListOf<TaskTemplate>()
        for ((seriesId, tasks) in groupedTasks) {
            val template = tasks.maxByOrNull { it.dueDate } ?: continue
            if (!template.dueDate.isBefore(today)) continue
            val recurrenceRule = normalizeRecurrenceRule(template.recurrenceRule) ?: continue
            val anchorDate = tasks.mapNotNull { it.recurrenceAnchorDate }.minOrNull() ?: tasks.minOf { it.dueDate }

            var occurrence = 1L
            var nextDueDate = recurringDueDate(anchorDate, recurrenceRule, occurrence)
            while (!nextDueDate.isAfter(template.dueDate)) {
                occurrence++
                nextDueDate = recurringDueDate(anchorDate, recurrenceRule, occurrence)
            }
            var followingDueDate = recurringDueDate(anchorDate, recurrenceRule, occurrence + 1)
            while (!followingDueDate.isAfter(today)) {
                occurrence++
                nextDueDate = followingDueDate
                followingDueDate = recurringDueDate(anchorDate, recurrenceRule, occurrence + 1)
            }

            tasksToAssign.add(
                TaskTemplate(
                    recurrenceSeriesId = seriesId,
                    title = template.title,
                    recurrenceRule = recurrenceRule,
                    category = template.category,
                    xp = template.xp,
                    anchorDate = anchorDate,
                    nextDueDate = nextDueDate,
                    lastAssignee = template.assignee,
                ),
            )
        }

        for (task in tasksToAssign) {
            taskRepository.save(
                TaskItem(
                    title = task.title,
                    assignee = task.lastAssignee ?: members.first().name,
                    collectiveCode = collectiveCode,
                    dueDate = task.nextDueDate,
                    category = task.category,
                    xp = task.xp,
                    recurring = true,
                    recurrenceRule = task.recurrenceRule,
                    recurrenceSeriesId = task.recurrenceSeriesId,
                    recurrenceAnchorDate = task.anchorDate,
                ),
            )
        }

        rebalanceFutureRecurringTasks(collectiveCode)
    }

    // #6 Gentle nudge: a light, private reminder to a task's assignee. No public shaming —
    // only the assignee is notified, and you cannot nudge yourself or a completed task.
    @Transactional
    fun nudgeTask(
        taskId: Long,
        actorName: String,
    ): TaskDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val task =
            taskRepository.findByIdAndCollectiveCode(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")
        require(!task.completed) { "Task is already done" }
        require(task.assignee != actorName) { "You cannot nudge yourself" }

        notificationService.createParameterizedNotification(
            userName = task.assignee,
            type = "TASK_NUDGE",
            params = mapOf("sender" to actorName, "title" to task.title),
        )
        return task.toDto(taskFeedbackRepository.findAllByTaskId(task.id))
    }

    private fun calculateCompletionAwardXp(task: TaskItem): Int =
        if (task.dueDate.isBefore(LocalDate.now())) {
            calculateLateCompletionXp(task.xp)
        } else {
            task.xp
        }

    private fun calculateLateCompletionXp(baseXp: Int): Int = (baseXp / 2).coerceAtLeast(1)

    private fun levelForXp(xp: Int): Int = xp / XP_PER_LEVEL + 1

    private fun calculatePenaltyXp(task: TaskItem): Int = -kotlin.math.abs(task.xp)

    private fun recurringDueDate(
        anchorDate: LocalDate,
        recurrenceRule: String,
        occurrence: Long,
    ): LocalDate =
        when (recurrenceRule.uppercase()) {
            "DAILY" -> anchorDate.plusDays(occurrence)
            "MONTHLY" -> anchorDate.plusMonths(occurrence)
            else -> anchorDate.plusWeeks(occurrence)
        }

    private fun rebalanceFutureRecurringTasks(collectiveCode: String): List<TaskItem> {
        val memberNames =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.status == MemberStatus.ACTIVE }
                .map { it.name }
                .sorted()
        if (memberNames.isEmpty()) return emptyList()

        val today = LocalDate.now()
        val recurringTasks =
            taskRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { isRecurringTask(it.recurrenceRule) }
        val futureTasks =
            recurringTasks
                .filter { !it.completed && !it.dueDate.isBefore(today) }
                .sortedWith(compareBy<TaskItem> { it.dueDate }.thenBy { recurrenceSeriesKey(it) })

        // Deterministic round-robin: every recurrence series owns a stable slot, and each week the
        // whole household shifts one seat (the week index). Over one full cycle — whose length is
        // the number of active members — each member serves every task exactly once, then the
        // pattern repeats identically. When membership changes (someone joins, leaves, or toggles
        // away/home) the seating is re-derived immediately, so a newcomer is folded into the
        // rotation straight away and the load stays even for everyone.
        val seriesSlot =
            futureTasks
                .map { recurrenceSeriesKey(it) }
                .distinct()
                .sorted()
                .withIndex()
                .associate { (index, key) -> key to index }
        val savedTasks = mutableListOf<TaskItem>()

        for (task in futureTasks) {
            val slot = seriesSlot.getValue(recurrenceSeriesKey(task))
            val seat = Math.floorMod(slot + rotationWeekIndex(task.dueDate), memberNames.size)
            val assignee = memberNames[seat]
            savedTasks += if (task.assignee == assignee) task else taskRepository.save(task.copy(assignee = assignee))
        }

        return savedTasks
    }

    // Stable, ever-increasing week counter so the rotation advances exactly one seat every Monday
    // and lands on the same arrangement again after a full cycle. The epoch is an arbitrary Monday;
    // only the number of weeks between two dates matters.
    private fun rotationWeekIndex(dueDate: LocalDate): Long = ChronoUnit.WEEKS.between(rotationEpoch, dueDate.with(DayOfWeek.MONDAY))

    private fun recurrenceSeriesKey(task: TaskItem): String =
        task.recurrenceSeriesId
            ?: UUID.nameUUIDFromBytes(
                "${task.collectiveCode}::${task.title}::${normalizeRecurrenceRule(task.recurrenceRule)}".toByteArray(UTF_8),
            ).toString()

    private fun normalizeRecurrenceRule(
        recurrenceRule: String?,
        recurringFallback: Boolean = false,
    ): String? {
        val normalized = recurrenceRule?.trim()?.uppercase()
        return when {
            normalized.isNullOrBlank() || normalized == "NONE" -> {
                if (recurringFallback) "WEEKLY" else null
            }

            normalized in setOf("DAILY", "WEEKLY", "MONTHLY") -> {
                normalized
            }

            else -> {
                normalized
            }
        }
    }

    private fun isRecurringTask(recurrenceRule: String?): Boolean = !recurrenceRule.isNullOrBlank() && recurrenceRule.uppercase() != "NONE"

    private fun TaskItem.toDto(feedbacks: List<TaskFeedback> = emptyList()) =
        TaskDto(
            id = id,
            title = title,
            assignee = assignee,
            dueDate = dueDate,
            category = category,
            completed = completed,
            xp = xp,
            recurrenceRule = recurrenceRule,
            penaltyXp = penaltyXp,
            feedbacks =
                feedbacks.map { fb ->
                    TaskFeedbackDto(
                        id = fb.id,
                        author = if (fb.anonymous) null else fb.author,
                        message = fb.message,
                        anonymous = fb.anonymous,
                        imageData = fb.imageData,
                        imageMimeType = fb.imageMimeType,
                        createdAt = fb.createdAt,
                    )
                },
            completionImageData = completionImageData,
            completionImageMime = completionImageMime,
        )
}
