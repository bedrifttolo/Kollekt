package com.kollekt.repository

import com.kollekt.domain.TaskHistoryEntry
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface TaskHistoryRepository : JpaRepository<TaskHistoryEntry, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<TaskHistoryEntry>

    @Modifying
    @Query("update TaskHistoryEntry t set t.assignee = :newName where t.assignee = :oldName and t.collectiveCode = :collectiveCode")
    fun renameAssignee(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int

    @Modifying
    @Query("update TaskHistoryEntry t set t.completedBy = :newName where t.completedBy = :oldName and t.collectiveCode = :collectiveCode")
    fun renameCompletedBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
