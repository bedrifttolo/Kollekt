package com.kollekt.repository

import com.kollekt.domain.MaintenanceTicket
import com.kollekt.domain.MaintenanceTicketStatusHistory
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface MaintenanceTicketRepository : JpaRepository<MaintenanceTicket, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<MaintenanceTicket>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from MaintenanceTicket t where t.id = :id and t.collectiveCode = :collectiveCode")
    fun findByIdAndCollectiveCodeForUpdate(
        @Param("id") id: Long,
        @Param("collectiveCode") collectiveCode: String,
    ): MaintenanceTicket?

    // splitParticipants (a comma-joined TEXT column) is renamed separately in MemberRenameOperations,
    // decoding/re-encoding per row rather than via a bulk column update.
    fun findAllByCollectiveCodeAndSplitParticipantsContaining(
        collectiveCode: String,
        needle: String,
    ): List<MaintenanceTicket>

    @Modifying
    @Query("update MaintenanceTicket t set t.assignee = :newName where t.assignee = :oldName and t.collectiveCode = :collectiveCode")
    fun renameAssignee(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int

    @Modifying
    @Query("update MaintenanceTicket t set t.createdBy = :newName where t.createdBy = :oldName and t.collectiveCode = :collectiveCode")
    fun renameCreatedBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}

interface MaintenanceTicketStatusHistoryRepository : JpaRepository<MaintenanceTicketStatusHistory, Long> {
    fun findAllByTicketIdOrderByChangedAtAsc(ticketId: Long): List<MaintenanceTicketStatusHistory>

    fun findAllByTicketIdInOrderByChangedAtAsc(ticketIds: Collection<Long>): List<MaintenanceTicketStatusHistory>

    @Modifying
    @Query(
        "update MaintenanceTicketStatusHistory h set h.changedBy = :newName where h.changedBy = :oldName and " +
            "h.ticketId in (select t.id from MaintenanceTicket t where t.collectiveCode = :collectiveCode)",
    )
    fun renameChangedBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
