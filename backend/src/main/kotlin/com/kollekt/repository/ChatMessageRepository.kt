package com.kollekt.repository

import com.kollekt.domain.ChatMessage
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface ChatMessageRepository : JpaRepository<ChatMessage, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<ChatMessage>

    /** Household thread only: messages with no private recipient. */
    fun findAllByCollectiveCodeAndRecipientIsNull(collectiveCode: String): List<ChatMessage>

    /** The 1:1 thread between two members (both directions), within their collective. */
    @Query(
        "SELECT m FROM ChatMessage m WHERE m.collectiveCode = :collectiveCode AND m.recipient IS NOT NULL AND " +
            "((m.sender = :memberName AND m.recipient = :otherName) OR (m.sender = :otherName AND m.recipient = :memberName))",
    )
    fun findDirectThread(
        @Param("collectiveCode") collectiveCode: String,
        @Param("memberName") memberName: String,
        @Param("otherName") otherName: String,
    ): List<ChatMessage>

    fun existsByReplyToMessageId(replyToMessageId: Long): Boolean
}
