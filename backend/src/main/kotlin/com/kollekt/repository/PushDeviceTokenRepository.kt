package com.kollekt.repository

import com.kollekt.domain.PushDeviceToken
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface PushDeviceTokenRepository : JpaRepository<PushDeviceToken, String> {
    fun findByMemberName(memberName: String): List<PushDeviceToken>

    // No collective_code column here; a bare name match is the accepted, pre-existing scoping
    // level for this table (see findByMemberName above) — same residual cross-household risk.
    @Modifying
    @Query("update PushDeviceToken p set p.memberName = :newName where p.memberName = :oldName")
    fun renameMemberName(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
    ): Int
}
