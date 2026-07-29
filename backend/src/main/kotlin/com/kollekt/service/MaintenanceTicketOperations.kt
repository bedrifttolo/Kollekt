package com.kollekt.service

import com.kollekt.api.dto.CreateExpenseRequest
import com.kollekt.api.dto.CreateMaintenanceTicketRequest
import com.kollekt.api.dto.MaintenanceStatusHistoryDto
import com.kollekt.api.dto.MaintenanceTicketDto
import com.kollekt.api.dto.UpdateMaintenanceTicketRequest
import com.kollekt.domain.MaintenancePriority
import com.kollekt.domain.MaintenanceStatus
import com.kollekt.domain.MaintenanceTicket
import com.kollekt.domain.MaintenanceTicketStatusHistory
import com.kollekt.repository.MaintenanceTicketRepository
import com.kollekt.repository.MaintenanceTicketStatusHistoryRepository
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.LocalDateTime

@Service
class MaintenanceTicketOperations(
    private val ticketRepository: MaintenanceTicketRepository,
    private val historyRepository: MaintenanceTicketStatusHistoryRepository,
    private val memberRepository: MemberRepository,
    private val collectiveAccessService: CollectiveAccessService,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val economyOperations: EconomyOperations,
) {
    fun getAll(
        actorName: String,
        status: MaintenanceStatus?,
        priority: MaintenancePriority?,
    ): List<MaintenanceTicketDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val doneCutoff = LocalDateTime.now().minusDays(1)
        val tickets =
            ticketRepository.findAllByCollectiveCode(collectiveCode)
                .asSequence()
                .filter { it.status != MaintenanceStatus.DONE || it.updatedAt.isAfter(doneCutoff) }
                .filter { status == null || it.status == status }
                .filter { priority == null || it.priority == priority }
                .sortedWith(
                    compareBy<MaintenanceTicket> { it.status == MaintenanceStatus.DONE }
                        .thenByDescending { it.priority }
                        .thenBy { it.dueDate },
                )
                .toList()
        val historyByTicket =
            historyRepository
                .findAllByTicketIdInOrderByChangedAtAsc(tickets.map { it.id })
                .groupBy { it.ticketId }
        return tickets.map { it.toDto(historyByTicket[it.id].orEmpty()) }
    }

    @Transactional
    fun create(
        request: CreateMaintenanceTicketRequest,
        actorName: String,
    ): MaintenanceTicketDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val title = request.title.trim()
        require(title.isNotBlank()) { "Ticket title is required" }
        validateAssignee(request.assignee, collectiveCode)
        require(request.costEstimate == null || request.costEstimate >= 0) { "Cost estimate cannot be negative" }
        val saved =
            ticketRepository.save(
                MaintenanceTicket(
                    collectiveCode = collectiveCode,
                    title = title,
                    description = request.description.trim(),
                    priority = request.priority,
                    assignee = request.assignee,
                    dueDate = request.dueDate,
                    costEstimate = request.costEstimate,
                    splitParticipants = encodeParticipants(request.splitParticipants, collectiveCode),
                    createdBy = actorName,
                ),
            )
        historyRepository.save(MaintenanceTicketStatusHistory(ticketId = saved.id, status = saved.status, changedBy = actorName))
        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "MAINTENANCE_UPDATED", dto)
        return dto
    }

    @Transactional
    fun update(
        ticketId: Long,
        request: UpdateMaintenanceTicketRequest,
        actorName: String,
    ): MaintenanceTicketDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val ticket =
            ticketRepository.findByIdAndCollectiveCodeForUpdate(ticketId, collectiveCode)
                ?: throw IllegalArgumentException("Maintenance ticket $ticketId not found")
        val assignee = if (request.assignee != null) request.assignee.trim().takeIf { it.isNotBlank() } else ticket.assignee
        validateAssignee(assignee, collectiveCode)
        val costEstimate = request.costEstimate ?: ticket.costEstimate
        require(costEstimate == null || costEstimate >= 0) { "Cost estimate cannot be negative" }
        val status = request.status ?: ticket.status
        val splitParticipants =
            if (request.splitParticipants != null) {
                encodeParticipants(
                    request.splitParticipants,
                    collectiveCode,
                )
            } else {
                ticket.splitParticipants
            }
        val saved =
            ticketRepository.save(
                ticket.copy(
                    title = request.title?.trim()?.takeIf { it.isNotBlank() } ?: ticket.title,
                    description = request.description?.trim() ?: ticket.description,
                    priority = request.priority ?: ticket.priority,
                    status = status,
                    assignee = assignee,
                    dueDate = request.dueDate ?: ticket.dueDate,
                    costEstimate = costEstimate,
                    splitParticipants = splitParticipants,
                    updatedAt = LocalDateTime.now(),
                ),
            )
        if (status != ticket.status) {
            historyRepository.save(MaintenanceTicketStatusHistory(ticketId = ticketId, status = status, changedBy = actorName))
        }
        // Completing a ticket with a cost turns it into a shared expense the completer paid.
        if (status == MaintenanceStatus.DONE && ticket.status != MaintenanceStatus.DONE) {
            settleTicketCost(saved, actorName, collectiveCode, request.category ?: "Bills")
        }
        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "MAINTENANCE_UPDATED", dto)
        return dto
    }

    @Transactional
    fun delete(
        ticketId: Long,
        actorName: String,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val ticket =
            ticketRepository.findByIdAndCollectiveCodeForUpdate(ticketId, collectiveCode)
                ?: throw IllegalArgumentException("Maintenance ticket $ticketId not found")
        historyRepository.deleteAll(historyRepository.findAllByTicketIdOrderByChangedAtAsc(ticketId))
        ticketRepository.delete(ticket)
        realtimeUpdateService.publish(collectiveCode, "MAINTENANCE_DELETED", mapOf("id" to ticketId))
    }

    private fun settleTicketCost(
        ticket: MaintenanceTicket,
        completedBy: String,
        collectiveCode: String,
        category: String,
    ) {
        val cost = ticket.costEstimate ?: return
        if (cost <= 0) return
        val participants =
            decodeParticipants(ticket.splitParticipants)
                .filter { memberRepository.findByNameAndCollectiveCode(it, collectiveCode) != null }
        if (participants.isEmpty()) return
        economyOperations.createExpense(
            CreateExpenseRequest(
                description = "🔧 ${ticket.title}",
                amount = cost,
                paidBy = completedBy,
                category = category,
                date = LocalDate.now(),
                participantNames = participants,
            ),
            completedBy,
        )
    }

    private fun encodeParticipants(
        names: List<String>,
        collectiveCode: String,
    ): String? {
        val valid =
            names.map { it.trim() }.filter { it.isNotBlank() }.distinct()
                .filter { memberRepository.findByNameAndCollectiveCode(it, collectiveCode) != null }
        return valid.takeIf { it.isNotEmpty() }?.joinToString(",")
    }

    private fun decodeParticipants(encoded: String?): List<String> =
        encoded?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() } ?: emptyList()

    private fun validateAssignee(
        assignee: String?,
        collectiveCode: String,
    ) {
        if (assignee != null && memberRepository.findByNameAndCollectiveCode(assignee, collectiveCode) == null) {
            throw IllegalArgumentException("Assignee is not in your collective")
        }
    }

    private fun MaintenanceTicket.toDto(
        statusHistoryEntries: List<MaintenanceTicketStatusHistory> =
            historyRepository.findAllByTicketIdOrderByChangedAtAsc(id),
    ) = MaintenanceTicketDto(
        id = id,
        title = title,
        description = description,
        priority = priority,
        status = status,
        assignee = assignee,
        dueDate = dueDate,
        costEstimate = costEstimate,
        splitParticipants = decodeParticipants(splitParticipants),
        createdBy = createdBy,
        createdAt = createdAt,
        updatedAt = updatedAt,
        overdue = dueDate?.isBefore(LocalDate.now()) == true && status != MaintenanceStatus.DONE,
        statusHistory =
            statusHistoryEntries.map {
                MaintenanceStatusHistoryDto(it.id, it.status, it.changedBy, it.changedAt)
            },
    )
}
