package com.kollekt.repository

import com.kollekt.domain.Expense
import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface ExpenseRepository : JpaRepository<Expense, Long> {
    @EntityGraph(attributePaths = ["participantNames"])
    fun findAllByCollectiveCode(collectiveCode: String): List<Expense>

    fun findTopByCollectiveCodeOrderByIdDesc(collectiveCode: String): Expense?

    fun findAllByDeadlineDate(date: LocalDate): List<Expense>
}
