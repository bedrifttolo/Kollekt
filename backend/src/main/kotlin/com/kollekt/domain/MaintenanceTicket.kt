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

enum class MaintenancePriority { LOW, MEDIUM, HIGH, URGENT }

enum class MaintenanceStatus { OPEN, IN_PROGRESS, BLOCKED, DONE }

@Entity
@Table(name = "maintenance_ticket")
data class MaintenanceTicket(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val collectiveCode: String,
    @Column(nullable = false) val title: String,
    @Column(nullable = false, length = 1500) val description: String,
    @Enumerated(EnumType.STRING) @Column(nullable = false) val priority: MaintenancePriority,
    @Enumerated(EnumType.STRING) @Column(nullable = false) val status: MaintenanceStatus = MaintenanceStatus.OPEN,
    @Column(nullable = true) val assignee: String? = null,
    @Column(nullable = true) val dueDate: LocalDate? = null,
    @Column(nullable = true) val costEstimate: Int? = null,
    @Column(name = "split_participants", nullable = true, columnDefinition = "TEXT") val splitParticipants: String? = null,
    @Column(nullable = false) val createdBy: String,
    @Column(nullable = false) val createdAt: Instant = Instant.now(),
    @Column(nullable = false) val updatedAt: Instant = Instant.now(),
)

@Entity
@Table(name = "maintenance_ticket_status_history")
data class MaintenanceTicketStatusHistory(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val ticketId: Long,
    @Enumerated(EnumType.STRING) @Column(nullable = false) val status: MaintenanceStatus,
    @Column(nullable = false) val changedBy: String,
    @Column(nullable = false) val changedAt: Instant = Instant.now(),
)
