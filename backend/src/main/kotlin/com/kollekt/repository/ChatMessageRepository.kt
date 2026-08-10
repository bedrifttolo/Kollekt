package com.kollekt.repository

import com.kollekt.domain.ChatMessage
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
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

    /** Latest household message, for the chat inbox summary. */
    fun findTopByCollectiveCodeAndRecipientIsNullOrderByTimestampDesc(collectiveCode: String): ChatMessage?

    /** Every DM (either direction) `memberName` is party to, newest first — grouped by counterpart
     *  in the service layer to get "latest message per DM partner" in one query instead of N. */
    @Query(
        "SELECT m FROM ChatMessage m WHERE m.collectiveCode = :collectiveCode AND m.recipient IS NOT NULL AND " +
            "(m.sender = :memberName OR m.recipient = :memberName) ORDER BY m.timestamp DESC",
    )
    fun findAllDirectMessagesInvolving(
        @Param("collectiveCode") collectiveCode: String,
        @Param("memberName") memberName: String,
    ): List<ChatMessage>

    fun existsByReplyToMessageId(replyToMessageId: Long): Boolean

    // sender/recipient only — reactions and poll are serialized JSON blobs that can reference the
    // old name too, but rewriting those requires deserializing every matching row; out of scope
    // for v1 (see MemberRenameOperations).
    @Modifying
    @Query("update ChatMessage m set m.sender = :newName where m.sender = :oldName and m.collectiveCode = :collectiveCode")
    fun renameSender(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int

    @Modifying
    @Query("update ChatMessage m set m.recipient = :newName where m.recipient = :oldName and m.collectiveCode = :collectiveCode")
    fun renameRecipient(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
