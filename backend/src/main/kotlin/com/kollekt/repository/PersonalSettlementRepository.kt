package com.kollekt.repository

import com.kollekt.domain.PersonalSettlement
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface PersonalSettlementRepository : JpaRepository<PersonalSettlement, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<PersonalSettlement>

    fun findAllByCollectiveCodeAndPaidByAndPaidTo(
        collectiveCode: String,
        paidBy: String,
        paidTo: String,
    ): List<PersonalSettlement>

    fun deleteAllByCollectiveCodeAndPaidBy(
        collectiveCode: String,
        paidBy: String,
    )

    @Modifying
    @Query("update PersonalSettlement s set s.paidBy = :newName where s.paidBy = :oldName and s.collectiveCode = :collectiveCode")
    fun renamePaidBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int

    @Modifying
    @Query("update PersonalSettlement s set s.paidTo = :newName where s.paidTo = :oldName and s.collectiveCode = :collectiveCode")
    fun renamePaidTo(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
