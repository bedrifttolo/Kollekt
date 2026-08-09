package com.kollekt.repository

import com.kollekt.domain.Expense
import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDate

interface ExpenseRepository : JpaRepository<Expense, Long> {
    @EntityGraph(attributePaths = ["participantNames"])
    fun findAllByCollectiveCode(collectiveCode: String): List<Expense>

    fun findTopByCollectiveCodeOrderByIdDesc(collectiveCode: String): Expense?

    fun findAllByDeadlineDate(date: LocalDate): List<Expense>

    @Modifying
    @Query("update Expense e set e.paidBy = :newName where e.paidBy = :oldName and e.collectiveCode = :collectiveCode")
    fun renamePaidBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int

    // participantNames is an @ElementCollection join table, unreachable from JPQL — plain SQL instead.
    @Modifying
    @Query(
        value =
            "update expense_participants set member_name = :newName where member_name = :oldName and " +
                "expense_id in (select id from expenses where collective_code = :collectiveCode)",
        nativeQuery = true,
    )
    fun renameParticipant(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
