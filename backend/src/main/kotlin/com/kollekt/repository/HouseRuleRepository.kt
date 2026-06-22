package com.kollekt.repository

import com.kollekt.domain.HouseRule
import com.kollekt.domain.HouseRuleAck
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface HouseRuleRepository : JpaRepository<HouseRule, Long> {
    fun findFirstByCollectiveCodeOrderByVersionDesc(collectiveCode: String): HouseRule?

    fun findByCollectiveCodeAndVersion(
        collectiveCode: String,
        version: Int,
    ): HouseRule?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from HouseRule r where r.id = :id")
    fun findByIdForUpdate(
        @Param("id") id: Long,
    ): HouseRule?
}

interface HouseRuleAckRepository : JpaRepository<HouseRuleAck, Long> {
    fun existsByRuleIdAndMemberName(
        ruleId: Long,
        memberName: String,
    ): Boolean
}
