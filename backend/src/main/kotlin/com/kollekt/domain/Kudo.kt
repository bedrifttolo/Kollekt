package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "kudos")
data class Kudo(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val collectiveCode: String,
    @Column(nullable = false) val sender: String,
    @Column(nullable = false) val receiver: String,
    @Column(nullable = true) val taskId: Long? = null,
    @Column(nullable = false, length = 32) val type: String = "THANK_YOU",
    @Column(nullable = false, length = 500) val context: String,
    @Column(nullable = false) val createdAt: LocalDateTime = LocalDateTime.now(),
)
