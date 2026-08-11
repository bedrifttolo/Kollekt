package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.time.LocalDate

@Entity
@Table(name = "house_checkins")
data class HouseCheckin(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val collectiveCode: String,
    @Column(nullable = false) val weekStart: LocalDate,
    @Column(nullable = false) val createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "checkin_responses")
data class CheckinResponse(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val checkinId: Long,
    @Column(nullable = false) val memberName: String,
    @Column(nullable = false) val mood: Int,
    @Column(nullable = false, length = 1000) val issue: String,
    @Column(nullable = false, length = 1000) val improvement: String,
    @Column(nullable = false) val anonymous: Boolean = false,
    @Column(nullable = false) val createdAt: Instant = Instant.now(),
)
