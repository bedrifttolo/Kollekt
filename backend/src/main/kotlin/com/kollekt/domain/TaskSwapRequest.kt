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

enum class TaskSwapRequestStatus {
    PENDING,
    ACCEPTED,
    DECLINED,
}

@Entity
@Table(name = "task_swap_requests")
data class TaskSwapRequest(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val fromUser: String,
    @Column(nullable = false) val toUser: String,
    @Column(nullable = false) val taskId: Long,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false) val status: TaskSwapRequestStatus = TaskSwapRequestStatus.PENDING,
    @Column(nullable = false) val expiresAt: Instant,
)
