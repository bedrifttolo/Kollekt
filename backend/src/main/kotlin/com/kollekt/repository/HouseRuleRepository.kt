package com.kollekt.repository

import com.kollekt.domain.HouseRule
import com.kollekt.domain.HouseRuleAck
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
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

    @Modifying
    @Query("update HouseRule r set r.updatedBy = :newName where r.updatedBy = :oldName and r.collectiveCode = :collectiveCode")
    fun renameUpdatedBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}

interface HouseRuleAckRepository : JpaRepository<HouseRuleAck, Long> {
    fun existsByRuleIdAndMemberName(
        ruleId: Long,
        memberName: String,
    ): Boolean

    @Modifying
    @Query(
        "update HouseRuleAck a set a.memberName = :newName where a.memberName = :oldName and " +
            "a.ruleId in (select r.id from HouseRule r where r.collectiveCode = :collectiveCode)",
    )
    fun renameMemberName(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
