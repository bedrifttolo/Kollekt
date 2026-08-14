package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/**
 * The wallpaper behind one chat thread, shared by everyone who can see that thread.
 *
 * `threadKey` is canonical — see [com.kollekt.service.ChatBackgroundService.threadKey] — so both
 * participants in a direct message read and write the same row whichever of them set the picture.
 */
@Entity
@Table(name = "chat_backgrounds")
data class ChatBackground(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val collectiveCode: String,
    @Column(nullable = false, columnDefinition = "text") val threadKey: String,
    @Column(nullable = false, columnDefinition = "text") val imageData: String,
    @Column(nullable = false, length = 64) val imageMimeType: String,
    @Column(nullable = false) val setBy: String,
    @Column(nullable = false) val updatedAt: Instant = Instant.now(),
)
