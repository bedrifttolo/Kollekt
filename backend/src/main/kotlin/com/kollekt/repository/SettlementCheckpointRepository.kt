package com.kollekt.repository

import com.kollekt.domain.SettlementCheckpoint
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface SettlementCheckpointRepository : JpaRepository<SettlementCheckpoint, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<SettlementCheckpoint>

    fun findTopByCollectiveCodeOrderByIdDesc(collectiveCode: String): SettlementCheckpoint?

    fun findTopByCollectiveCodeAndSettledByOrderByIdDesc(
        collectiveCode: String,
        settledBy: String,
    ): SettlementCheckpoint?

    @Modifying
    @Query("update SettlementCheckpoint s set s.settledBy = :newName where s.settledBy = :oldName and s.collectiveCode = :collectiveCode")
    fun renameSettledBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
