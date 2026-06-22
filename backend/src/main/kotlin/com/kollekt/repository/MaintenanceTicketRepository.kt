package com.kollekt.repository

import com.kollekt.domain.MaintenanceTicket
import com.kollekt.domain.MaintenanceTicketStatusHistory
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
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
}

interface MaintenanceTicketStatusHistoryRepository : JpaRepository<MaintenanceTicketStatusHistory, Long> {
    fun findAllByTicketIdOrderByChangedAtAsc(ticketId: Long): List<MaintenanceTicketStatusHistory>
}
