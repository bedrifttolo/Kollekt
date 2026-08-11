package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "chat_messages")
data class ChatMessage(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val sender: String,
    @Column(nullable = true) val collectiveCode: String? = null,
    // NULL = household-wide message; non-NULL = private 1:1 message to this member.
    @Column(nullable = true) val recipient: String? = null,
    @Column(nullable = false, length = 1500) val text: String,
    @Column(nullable = true, columnDefinition = "TEXT") val imageData: String? = null,
    @Column(nullable = true, length = 120) val imageMimeType: String? = null,
    @Column(nullable = true, length = 255) val imageFileName: String? = null,
    @Column(nullable = true) val replyToMessageId: Long? = null,
    @Column(nullable = false) val timestamp: Instant,
    @Column(nullable = false, columnDefinition = "TEXT") val reactions: String = "{}",
    @Column(nullable = true, columnDefinition = "TEXT") val poll: String? = null,
    @Column(nullable = false) val pinned: Boolean = false,
    @Column(nullable = false) val edited: Boolean = false,
    @Column(nullable = false) val deleted: Boolean = false,
)
