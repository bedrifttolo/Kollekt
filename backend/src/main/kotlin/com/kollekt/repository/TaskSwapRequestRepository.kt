package com.kollekt.repository

import com.kollekt.domain.TaskSwapRequest
import com.kollekt.domain.TaskSwapRequestStatus
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
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

    @Modifying
    @Query(
        "update TaskSwapRequest r set r.fromUser = :newName where r.fromUser = :oldName and " +
            "r.taskId in (select t.id from TaskItem t where t.collectiveCode = :collectiveCode)",
    )
    fun renameFromUser(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int

    @Modifying
    @Query(
        "update TaskSwapRequest r set r.toUser = :newName where r.toUser = :oldName and " +
            "r.taskId in (select t.id from TaskItem t where t.collectiveCode = :collectiveCode)",
    )
    fun renameToUser(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
