package com.kollekt.repository

import com.kollekt.domain.TaskHistoryEntry
import org.springframework.data.jpa.repository.JpaRepository

interface TaskHistoryRepository : JpaRepository<TaskHistoryEntry, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<TaskHistoryEntry>
}
