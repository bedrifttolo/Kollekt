package com.kollekt.repository

import com.kollekt.domain.TaskItem
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface TaskRepository : JpaRepository<TaskItem, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<TaskItem>

    fun findAllByIdInAndCollectiveCode(
        ids: Collection<Long>,
        collectiveCode: String,
    ): List<TaskItem>

    fun findByIdAndCollectiveCode(
        id: Long,
        collectiveCode: String,
    ): TaskItem?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TaskItem t where t.id = :id and t.collectiveCode = :collectiveCode")
    fun findByIdAndCollectiveCodeForUpdate(
        @Param("id") id: Long,
        @Param("collectiveCode") collectiveCode: String,
    ): TaskItem?

    @Modifying
    @Query("update TaskItem t set t.assignee = :newName where t.assignee = :oldName and t.collectiveCode = :collectiveCode")
    fun renameAssignee(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int

    @Modifying
    @Query("update TaskItem t set t.completedBy = :newName where t.completedBy = :oldName and t.collectiveCode = :collectiveCode")
    fun renameCompletedBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
