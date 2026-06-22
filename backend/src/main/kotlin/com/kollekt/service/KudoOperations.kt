package com.kollekt.service

import com.kollekt.api.dto.CreateKudoRequest
import com.kollekt.api.dto.KudoDto
import com.kollekt.api.dto.KudosRecipientSummaryDto
import com.kollekt.api.dto.KudosWeeklySummaryDto
import com.kollekt.domain.Kudo
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.KudoRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.TemporalAdjusters

@Service
class KudoOperations(
    private val kudoRepository: KudoRepository,
    private val memberRepository: MemberRepository,
    private val taskRepository: TaskRepository,
    private val collectiveAccessService: CollectiveAccessService,
    private val notificationService: NotificationService,
) {
    private val dailyCap = 3L
    private val kudoTypes = setOf("THANK_YOU", "CLEANEST", "MOST_HELPFUL", "PEACEMAKER")

    @Transactional
    fun create(
        request: CreateKudoRequest,
        actorName: String,
    ): KudoDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        memberRepository.findByNameAndCollectiveCodeForUpdate(actorName, collectiveCode)
            ?: throw IllegalArgumentException("Sender not found")
        val receiver =
            memberRepository.findByNameAndCollectiveCode(request.receiver, collectiveCode)
                ?: throw IllegalArgumentException("Receiver is not in your collective")
        require(receiver.status == MemberStatus.ACTIVE) { "Receiver must be active" }
        require(receiver.name != actorName) { "You cannot send kudos to yourself" }
        val context = request.context.trim()
        require(context.isNotBlank()) { "Kudos context is required" }
        require(context.length <= 500) { "Kudos context is too long" }
        val task =
            request.taskId?.let { taskId ->
                taskRepository.findByIdAndCollectiveCode(taskId, collectiveCode)
                    ?: throw IllegalArgumentException("Linked task not found")
            }
        val today = LocalDate.now()
        val sentToday = kudoRepository.countSentInRange(actorName, today.atStartOfDay(), today.plusDays(1).atStartOfDay())
        require(sentToday < dailyCap) { "Daily kudos limit reached" }
        val type = request.type.uppercase().takeIf { it in kudoTypes } ?: "THANK_YOU"
        val saved =
            kudoRepository.save(
                Kudo(
                    collectiveCode = collectiveCode,
                    sender = actorName,
                    receiver = receiver.name,
                    taskId = task?.id,
                    type = type,
                    context = context,
                ),
            )
        // Kudos are private: only the recipient is notified, nothing is broadcast to the collective.
        notificationService.createParameterizedNotification(
            userName = receiver.name,
            type = "KUDOS_RECEIVED",
            params = mapOf("sender" to actorName, "context" to context),
        )
        return saved.toDto(task?.title)
    }

    fun getFeed(actorName: String): List<KudoDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        return kudoRepository.findAllByCollectiveCodeOrderByCreatedAtDesc(collectiveCode)
            .map { kudo -> kudo.toDto(kudo.taskId?.let { taskRepository.findById(it).orElse(null)?.title }) }
    }

    fun getWeeklySummary(actorName: String): KudosWeeklySummaryDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        val start = LocalDateTime.of(weekStart, LocalTime.MIN)
        val end = start.plusWeeks(1)
        val weekly =
            kudoRepository.findAllByCollectiveCodeOrderByCreatedAtDesc(collectiveCode)
                .filter { it.createdAt >= start && it.createdAt < end }
        return KudosWeeklySummaryDto(
            weekStart = weekStart,
            total = weekly.size,
            recipients =
                weekly.groupingBy { it.receiver }.eachCount().entries
                    .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
                    .map { KudosRecipientSummaryDto(it.key, it.value) },
        )
    }

    private fun Kudo.toDto(taskTitle: String?) = KudoDto(id, sender, receiver, type, context, taskId, taskTitle, createdAt)
}
