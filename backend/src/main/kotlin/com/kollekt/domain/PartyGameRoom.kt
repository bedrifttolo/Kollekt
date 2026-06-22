package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "party_game_rooms")
data class PartyGameRoom(
    @Id @Column(length = 6) val code: String,
    @Column(nullable = false) val hostName: String,
    @Column(nullable = false, length = 16) val status: String = "LOBBY",
    @Column(nullable = false) val currentQuestionIndex: Int = 0,
    @Column(nullable = false) val createdAt: LocalDateTime = LocalDateTime.now(),
)

@Entity
@Table(name = "party_game_participants")
data class PartyGameParticipant(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false, length = 6) val roomCode: String,
    @Column(nullable = false) val memberName: String,
    @Column(nullable = false) val ready: Boolean = false,
    @Column(nullable = false) val joinedAt: LocalDateTime = LocalDateTime.now(),
)

@Entity
@Table(name = "party_game_questions")
data class PartyGameQuestion(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false, length = 6) val roomCode: String,
    @Column(nullable = false) val authorName: String,
    @Column(nullable = false, length = 40) val category: String,
    @Column(nullable = false, length = 300) val prompt: String,
    @Column(nullable = true) val playOrder: Int? = null,
    @Column(nullable = false) val createdAt: LocalDateTime = LocalDateTime.now(),
)
