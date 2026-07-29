package com.kollekt.repository

import com.kollekt.domain.Budget
import org.springframework.data.jpa.repository.JpaRepository

interface BudgetRepository : JpaRepository<Budget, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<Budget>

    fun findByCollectiveCodeAndCategory(
        collectiveCode: String,
        category: String,
    ): Budget?
}
