package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "meeting_topics")
data class MeetingTopic(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val collectiveCode: String,
    @Column(nullable = false, length = 300) val title: String,
    @Column(nullable = false) val createdBy: String,
    @Column(nullable = false) val createdAt: Instant = Instant.now(),
    @Column(nullable = false) val resolved: Boolean = false,
)
