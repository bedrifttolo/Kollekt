package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

@Entity
@Table(name = "guest_notices")
data class GuestNotice(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val collectiveCode: String,
    @Column(nullable = false) val createdBy: String,
    @Column(nullable = false) val guestName: String,
    @Column(name = "notice_date", nullable = false) val date: LocalDate,
    @Column(nullable = false) val startTime: LocalTime,
    @Column(nullable = false) val endTime: LocalTime,
    @Column(nullable = false) val overnight: Boolean = false,
    @Column(nullable = false) val createdAt: LocalDateTime = LocalDateTime.now(),
)

@Entity
@Table(name = "collective_quiet_hours")
data class CollectiveQuietHours(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false, unique = true) val collectiveCode: String,
    @Column(nullable = false) val enabled: Boolean = true,
    @Column(nullable = false) val startTime: LocalTime,
    @Column(nullable = false) val endTime: LocalTime,
)
