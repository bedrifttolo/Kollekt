package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

enum class AttendanceStatus {
    JOINING,
    PASSING,
}

@Entity
@Table(name = "event_attendance")
data class EventAttendance(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val eventId: Long,
    @Column(nullable = false) val memberName: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    val status: AttendanceStatus,
)
