package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

/** A household's self-set monthly spending cap for one expense category. Recurs every month by
 *  design — actual spend for the month is derived live from `expenses`, not stored here. */
@Entity
@Table(name = "budgets")
data class Budget(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(name = "collective_code", nullable = false) val collectiveCode: String,
    @Column(nullable = false) val category: String,
    @Column(name = "monthly_limit", nullable = false) val monthlyLimit: Int,
)
