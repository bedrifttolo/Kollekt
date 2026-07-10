package com.kollekt.service

import com.kollekt.api.dto.TaskDto
import com.kollekt.api.dto.TaskFeedbackDto
import com.kollekt.api.dto.TaskSwapRequestDto
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskItem
import com.kollekt.domain.TaskSwapRequest
import com.kollekt.domain.TaskSwapRequestStatus
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskFeedbackRepository
import com.kollekt.repository.TaskRepository
import com.kollekt.repository.TaskSwapRequestRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit

@Service
class TaskSwapOperations(
    private val swapRequestRepository: TaskSwapRequestRepository,
    private val taskRepository: TaskRepository,
    private val taskFeedbackRepository: TaskFeedbackRepository,
    private val memberRepository: MemberRepository,
    private val notificationService: NotificationService,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val collectiveAccessService: CollectiveAccessService,
) {
    @Transactional
    fun createRequest(
        taskId: Long,
        toUser: String,
        actorName: String,
    ): TaskSwapRequestDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task $taskId not found")
        if (task.completed) throw IllegalArgumentException("Completed tasks cannot be swapped")
        if (task.assignee != actorName) throw AccessDeniedException("Only the task assignee can request a swap")
        if (toUser == actorName) throw IllegalArgumentException("Choose another household member")

        val recipient =
            memberRepository.findByNameAndCollectiveCode(toUser, collectiveCode)
                ?: throw IllegalArgumentException("User '$toUser' is not in your collective")
        if (recipient.status != MemberStatus.ACTIVE) throw IllegalArgumentException("Swap recipient must be active")

        val hasPendingRequest =
            swapRequestRepository
                .findAllByTaskIdAndStatus(taskId, TaskSwapRequestStatus.PENDING)
                .any { it.expiresAt.isAfter(Instant.now()) }
        if (hasPendingRequest) {
            throw IllegalArgumentException("This task already has a pending swap request")
        }

        val saved =
            swapRequestRepository.save(
                TaskSwapRequest(
                    fromUser = actorName,
                    toUser = toUser,
                    taskId = taskId,
                    expiresAt = Instant.now().plus(7, ChronoUnit.DAYS),
                ),
            )
        notificationService.createParameterizedNotification(
            userName = toUser,
            type = "TASK_SWAP_REQUESTED",
            params = mapOf("fromUser" to actorName, "title" to task.title),
        )
        return saved.toDto(task.title)
    }

    fun getRequestsForUser(
        userId: Long,
        actorName: String,
    ): List<TaskSwapRequestDto> {
        val user = memberRepository.findById(userId).orElseThrow { IllegalArgumentException("User $userId not found") }
        if (user.name != actorName) throw AccessDeniedException("Cannot view another user's swap requests")
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val requests = swapRequestRepository.findAllByToUserOrderByIdDesc(actorName)
        val tasksById =
            taskRepository
                .findAllByIdInAndCollectiveCode(requests.map { it.taskId }, collectiveCode)
                .associateBy { it.id }
        return requests.mapNotNull { request ->
            request.toDto(tasksById[request.taskId]?.title ?: return@mapNotNull null)
        }
    }

    @Transactional
    fun resolveRequest(
        requestId: Long,
        requestedStatus: String,
        actorName: String,
    ): TaskSwapRequestDto {
        val status =
            when (requestedStatus.uppercase()) {
                "ACCEPTED" -> TaskSwapRequestStatus.ACCEPTED
                "DECLINED" -> TaskSwapRequestStatus.DECLINED
                else -> throw IllegalArgumentException("Status must be ACCEPTED or DECLINED")
            }
        val request =
            swapRequestRepository.findByIdForUpdate(requestId)
                ?: throw IllegalArgumentException("Swap request $requestId not found")
        if (request.toUser != actorName) throw AccessDeniedException("Only the recipient can resolve this request")
        if (request.status != TaskSwapRequestStatus.PENDING) throw IllegalArgumentException("Swap request is already resolved")
        if (!request.expiresAt.isAfter(Instant.now())) throw IllegalArgumentException("Swap request has expired")

        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val task =
            taskRepository.findByIdAndCollectiveCodeForUpdate(request.taskId, collectiveCode)
                ?: throw IllegalArgumentException("Task ${request.taskId} not found")
        if (task.completed) throw IllegalArgumentException("Completed tasks cannot be swapped")
        if (task.assignee != request.fromUser) throw IllegalArgumentException("Task assignment has changed")

        val savedRequest = swapRequestRepository.save(request.copy(status = status))
        if (status == TaskSwapRequestStatus.ACCEPTED) {
            val savedTask = taskRepository.save(task.copy(assignee = request.toUser))
            realtimeUpdateService.publish(
                collectiveCode,
                "TASK_UPDATED",
                savedTask.toTaskDto(),
            )
        }
        notificationService.createParameterizedGroupNotification(
            userNames = listOf(request.fromUser, request.toUser),
            type = if (status == TaskSwapRequestStatus.ACCEPTED) "TASK_SWAP_ACCEPTED" else "TASK_SWAP_DECLINED",
            params =
                mapOf(
                    "title" to task.title,
                    "toUser" to request.toUser,
                ),
        )
        return savedRequest.toDto(task.title)
    }

    private fun TaskSwapRequest.toDto(taskTitle: String) =
        TaskSwapRequestDto(
            id = id,
            fromUser = fromUser,
            toUser = toUser,
            taskId = taskId,
            taskTitle = taskTitle,
            status = if (status == TaskSwapRequestStatus.PENDING && !expiresAt.isAfter(Instant.now())) "EXPIRED" else status.name,
            expiresAt = expiresAt,
        )

    private fun TaskItem.toTaskDto() =
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
                taskFeedbackRepository.findAllByTaskId(id).map { feedback ->
                    TaskFeedbackDto(
                        id = feedback.id,
                        author = if (feedback.anonymous) null else feedback.author,
                        message = feedback.message,
                        anonymous = feedback.anonymous,
                        imageData = feedback.imageData,
                        imageMimeType = feedback.imageMimeType,
                        createdAt = feedback.createdAt,
                    )
                },
        )
}
