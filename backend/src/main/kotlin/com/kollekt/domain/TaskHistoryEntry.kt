package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.time.LocalDate

/**
 * A compact snapshot of a task's stat-relevant facts, written right before the task
 * row is deleted (5 days after its due date). Read alongside live tasks so XP,
 * achievements and fairness keep their full history. Never used to derive [Member.xp],
 * which stays the authoritative lifetime XP.
 */
@Entity
@Table(name = "task_history")
data class TaskHistoryEntry(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = true) val collectiveCode: String? = null,
    @Column(nullable = false) val assignee: String,
    @Column(nullable = true) val completedBy: String? = null,
    @Column(nullable = false) val dueDate: LocalDate,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false) val category: TaskCategory = TaskCategory.OTHER,
    @Column(nullable = false) val completed: Boolean = false,
    @Column(nullable = true) val completedAt: Instant? = null,
    @Column(nullable = false) val xp: Int = 0,
    @Column(nullable = false) val penaltyXp: Int = 0,
    @Column(nullable = true, length = 128) val recurrenceRule: String? = null,
    @Column(nullable = true) val originalTaskId: Long? = null,
)
