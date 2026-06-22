package com.kollekt.service

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
) {
    fun getAll(
        actorName: String,
        status: MaintenanceStatus?,
        priority: MaintenancePriority?,
    ): List<MaintenanceTicketDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        return ticketRepository.findAllByCollectiveCode(collectiveCode)
            .asSequence()
            .filter { status == null || it.status == status }
            .filter { priority == null || it.priority == priority }
            .sortedWith(
                compareBy<MaintenanceTicket> { it.status == MaintenanceStatus.DONE }.thenByDescending { it.priority }.thenBy { it.dueDate },
            )
            .map { it.toDto() }
            .toList()
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
                    updatedAt = LocalDateTime.now(),
                ),
            )
        if (status != ticket.status) {
            historyRepository.save(MaintenanceTicketStatusHistory(ticketId = ticketId, status = status, changedBy = actorName))
        }
        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "MAINTENANCE_UPDATED", dto)
        return dto
    }

    private fun validateAssignee(
        assignee: String?,
        collectiveCode: String,
    ) {
        if (assignee != null && memberRepository.findByNameAndCollectiveCode(assignee, collectiveCode) == null) {
            throw IllegalArgumentException("Assignee is not in your collective")
        }
    }

    private fun MaintenanceTicket.toDto() =
        MaintenanceTicketDto(
            id = id,
            title = title,
            description = description,
            priority = priority,
            status = status,
            assignee = assignee,
            dueDate = dueDate,
            costEstimate = costEstimate,
            createdBy = createdBy,
            createdAt = createdAt,
            updatedAt = updatedAt,
            overdue = dueDate?.isBefore(LocalDate.now()) == true && status != MaintenanceStatus.DONE,
            statusHistory =
                historyRepository.findAllByTicketIdOrderByChangedAtAsc(id).map {
                    MaintenanceStatusHistoryDto(it.id, it.status, it.changedBy, it.changedAt)
                },
        )
}
