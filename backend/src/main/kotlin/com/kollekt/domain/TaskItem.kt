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

enum class TaskCategory {
    CLEANING,
    SMALL_CLEANING,
    VACUUMING,
    MOPPING,
    BATHROOM,
    KITCHEN,
    LAUNDRY,
    DISHES,
    TRASH,
    DUSTING,
    WINDOWS,
    SHOPPING,
    OTHER,
}

@Entity
@Table(name = "tasks")
data class TaskItem(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val title: String,
    @Column(nullable = false) val assignee: String,
    @Column(nullable = true) val collectiveCode: String? = null,
    @Column(nullable = false) val dueDate: LocalDate,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false) val category: TaskCategory = TaskCategory.OTHER,
    @Column(nullable = false) val completed: Boolean = false,
    @Column(nullable = false) val xpAwarded: Boolean = false,
    @Column(nullable = true) val completedBy: String? = null,
    @Column(nullable = true) val completedAt: Instant? = null,
    @Column(nullable = false) val xp: Int = 10,
    @Column(nullable = false) val penaltyXp: Int = 0,
    @Column(nullable = true, length = 128) val recurrenceRule: String? = null,
    @Column(nullable = true, length = 64) val recurrenceSeriesId: String? = null,
    @Column(nullable = true) val recurrenceAnchorDate: LocalDate? = null,
    @Deprecated("Use recurrenceRule instead")
    @Column(nullable = false) val recurring: Boolean = false,
    @Column(nullable = true, length = 512) val assignmentReason: String? = null,
    @Column(nullable = true, length = 1024) val assignmentFeedback: String? = null,
    @Column(nullable = true, length = 512) val assignmentScore: String? = null,
    @Column(name = "completion_image_data", nullable = true, columnDefinition = "TEXT") val completionImageData: String? = null,
    @Column(name = "completion_image_mime", nullable = true, length = 120) val completionImageMime: String? = null,
)
