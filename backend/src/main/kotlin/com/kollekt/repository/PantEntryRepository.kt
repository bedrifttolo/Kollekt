package com.kollekt.repository

import com.kollekt.domain.PantEntry
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface PantEntryRepository : JpaRepository<PantEntry, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<PantEntry>

    @Modifying
    @Query("update PantEntry p set p.addedBy = :newName where p.addedBy = :oldName and p.collectiveCode = :collectiveCode")
    fun renameAddedBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
