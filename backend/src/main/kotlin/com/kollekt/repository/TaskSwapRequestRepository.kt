package com.kollekt.repository

import com.kollekt.domain.TaskSwapRequest
import com.kollekt.domain.TaskSwapRequestStatus
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface TaskSwapRequestRepository : JpaRepository<TaskSwapRequest, Long> {
    fun findAllByToUserOrderByIdDesc(toUser: String): List<TaskSwapRequest>

    fun findAllByTaskIdAndStatus(
        taskId: Long,
        status: TaskSwapRequestStatus,
    ): List<TaskSwapRequest>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from TaskSwapRequest r where r.id = :id")
    fun findByIdForUpdate(
        @Param("id") id: Long,
    ): TaskSwapRequest?
}
