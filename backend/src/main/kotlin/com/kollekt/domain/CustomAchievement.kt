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

enum class CustomAchievementMetric {
    TASKS_COMPLETED,
    XP_EARNED,
    STREAK_DAYS,
    EARLY_COMPLETIONS,
    ON_TIME_COMPLETIONS,
    RECURRING_COMPLETIONS,
    CATEGORY_COMPLETIONS,
}

@Entity
@Table(name = "custom_achievements")
data class CustomAchievement(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val collectiveCode: String,
    @Column(nullable = false) val createdBy: String,
    @Column(nullable = false, length = 80) val title: String,
    @Column(nullable = false, length = 240) val description: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32) val metric: CustomAchievementMetric,
    @Column(nullable = false, length = 32) val icon: String = "sparkles",
    @Column(nullable = false) val target: Int,
    @Enumerated(EnumType.STRING)
    @Column(nullable = true, length = 32) val taskCategory: TaskCategory? = null,
    @Column(nullable = false) val createdAt: Instant = Instant.now(),
)
