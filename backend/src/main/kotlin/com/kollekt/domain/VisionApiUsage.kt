package com.kollekt.domain
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "vision_api_usage")
data class VisionApiUsage(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    // Calendar month this row counts calls for, e.g. "2026-08".
    @Column(nullable = false, unique = true)
    val period: String,
    @Column(name = "call_count", nullable = false)
    val callCount: Int = 0,
)
