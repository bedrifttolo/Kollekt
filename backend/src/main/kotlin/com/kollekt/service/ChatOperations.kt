package com.kollekt.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.kollekt.api.dto.ChatThreadSummaryDto
import com.kollekt.api.dto.CreateMessageRequest
import com.kollekt.api.dto.CreatePollRequest
import com.kollekt.api.dto.MessageDto
import com.kollekt.api.dto.PollDto
import com.kollekt.api.dto.PollOptionDto
import com.kollekt.api.dto.ReactionDto
import com.kollekt.domain.ChatMessage
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.ChatMessageRepository
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.time.LocalDateTime
import java.util.Base64

@Service
class ChatOperations(
    private val chatMessageRepository: ChatMessageRepository,
    private val memberRepository: MemberRepository,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val notificationService: NotificationService,
    private val collectiveAccessService: CollectiveAccessService,
) {
    private val objectMapper = jacksonObjectMapper()
    // Kept in sync with the frontend's curated emoji-picker list in ChatThreadPage.tsx /
    // EmojiPickerSheet.tsx — this is the full set the reaction picker can offer, grouped the same
    // way the picker groups its categories.
    private val allowedReactionEmojis =
        setOf(
            // Smileys
            "😂", "😅", "😆", "😊", "😍", "🥰", "😘", "😜", "🤪", "🤔",
            "🙄", "😴", "🤯", "😮", "😢", "😭", "😡", "🥳", "😎", "🤗",
            "🙃", "😇", "🤩", "😬", "😱", "🥺", "🤨",
            // Hearts
            "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💕",
            "💔", "💯",
            // Hands / gestures
            "👍", "👎", "👏", "🙌", "🤝", "🙏", "👀", "✌️", "🤙", "💪",
            "🫶", "👋", "🤌",
            // Other / objects / symbols
            "🎉", "🔥", "✅", "❌", "⭐", "💀", "🤷", "🍕", "☕", "🎂",
            "‼️", "❓",
        )
    private val maxChatImageBytes = 5 * 1024 * 1024L

    fun getMessages(memberName: String): List<MessageDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        return chatMessageRepository
            .findAllByCollectiveCodeAndRecipientIsNull(collectiveCode)
            .sortedBy { it.timestamp }
            .map { it.toDto() }
    }

    /** The private 1:1 thread between the caller and another member of the same collective, or
     *  between the caller and the system pseudo-sender (see [SYSTEM_SENDER]). */
    fun getDirectMessages(
        memberName: String,
        otherName: String,
    ): List<MessageDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        require(memberName != otherName) { "Cannot open a direct thread with yourself" }
        if (otherName != SYSTEM_SENDER) {
            requireNotNull(memberRepository.findByNameAndCollectiveCode(otherName, collectiveCode)) {
                "Member '$otherName' is not in your collective"
            }
        }
        return chatMessageRepository
            .findDirectThread(collectiveCode, memberName, otherName)
            .sortedBy { it.timestamp }
            .map { it.toDto() }
    }

    /** The chat inbox: the household thread plus one row per DM thread the caller is party to,
     *  newest-first (threads with no messages yet sort after any with activity, then alphabetically). */
    fun getThreadSummaries(memberName: String): List<ChatThreadSummaryDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective = collectiveAccessService.requireCollectiveByCode(collectiveCode)

        val household = chatMessageRepository.findTopByCollectiveCodeAndRecipientIsNullOrderByTimestampDesc(collectiveCode)
        val householdSummary =
            ChatThreadSummaryDto(
                thread = null,
                displayName = collective.name,
                lastMessageId = household?.id,
                lastMessageSender = household?.sender,
                lastMessagePreview = household?.let(::previewOf),
                lastMessageTimestamp = household?.timestamp,
            )

        val otherMembers =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.status == MemberStatus.ACTIVE && it.name != memberName }
        val latestByCounterpart =
            chatMessageRepository
                .findAllDirectMessagesInvolving(collectiveCode, memberName)
                .groupBy { if (it.sender == memberName) it.recipient!! else it.sender }
                .mapValues { (_, msgs) -> msgs.maxByOrNull { it.timestamp } }

        val realMemberNames = otherMembers.map { it.name }.toSet()
        val dmSummaries =
            otherMembers.map { member -> threadSummaryFor(member.name, isSystem = false, latestByCounterpart[member.name]) } +
                (latestByCounterpart.keys - realMemberNames).map { counterpart ->
                    // Anything left over is a counterpart with no active Member row — currently only
                    // the anonymous violation-report pseudo-sender, but this stays generic so a DM
                    // also survives a member later leaving the household.
                    threadSummaryFor(counterpart, isSystem = counterpart == SYSTEM_SENDER, latestByCounterpart[counterpart])
                }

        return listOf(householdSummary) +
            dmSummaries.sortedWith(
                compareByDescending<ChatThreadSummaryDto> { it.lastMessageTimestamp != null }
                    .thenByDescending { it.lastMessageTimestamp }
                    .thenBy { it.displayName },
            )
    }

    private fun threadSummaryFor(
        thread: String,
        isSystem: Boolean,
        last: ChatMessage?,
    ) = ChatThreadSummaryDto(
        thread = thread,
        displayName = thread,
        isSystem = isSystem,
        lastMessageId = last?.id,
        lastMessageSender = last?.sender,
        lastMessagePreview = last?.let(::previewOf),
        lastMessageTimestamp = last?.timestamp,
    )

    // Household messages broadcast to the whole collective, same as before. DM messages only ever
    // reach their two participants — the payload is the full MessageDto (including `text`), so a
    // collective-wide publish would leak a private message's contents to every household member.
    private fun publishMessageUpdate(
        collectiveCode: String,
        message: ChatMessage,
        eventType: String,
        dto: MessageDto,
    ) {
        if (message.recipient == null) {
            realtimeUpdateService.publish(collectiveCode, eventType, dto)
        } else {
            realtimeUpdateService.publishToMembers(collectiveCode, setOf(message.sender, message.recipient), eventType, dto)
        }
    }

    private fun previewOf(message: ChatMessage): String =
        when {
            message.text.isNotBlank() -> if (message.text.length > 60) message.text.take(60) + "..." else message.text
            message.imageData != null -> "[Image]"
            else -> ""
        }

    @Transactional
    fun createDirectMessage(
        recipient: String,
        text: String,
        actorName: String,
        replyToMessageId: Long? = null,
    ): MessageDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val normalizedText = text.trim()
        require(normalizedText.isNotBlank()) { "Message text is required" }
        require(recipient != actorName) { "Cannot send a direct message to yourself" }
        val recipientMember =
            memberRepository.findByNameAndCollectiveCode(recipient, collectiveCode)
                ?: throw IllegalArgumentException("Member '$recipient' is not in your collective")

        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = actorName,
                    collectiveCode = collectiveCode,
                    recipient = recipientMember.name,
                    text = normalizedText,
                    replyToMessageId = replyToMessageId,
                    timestamp = LocalDateTime.now(),
                ),
            )

        val dto = saved.toDto()
        // Targeted: only the two participants ever receive a direct message — never the household.
        realtimeUpdateService.publishToMembers(
            collectiveCode,
            setOf(actorName, recipientMember.name),
            "DIRECT_MESSAGE_CREATED",
            dto,
        )
        val preview = if (normalizedText.length > 60) normalizedText.take(60) + "..." else normalizedText
        notificationService.createParameterizedGroupNotification(
            userNames = listOf(recipientMember.name),
            type = "NEW_MESSAGE",
            params = mapOf("sender" to actorName, "preview" to preview),
        )
        return dto
    }

    @Transactional
    fun createMessage(
        request: CreateMessageRequest,
        actorName: String,
    ): MessageDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val normalizedText = request.text.trim()
        require(normalizedText.isNotBlank()) { "Message text is required" }
        val replyToMessageId =
            request.replyToMessageId?.let { referencedMessageId ->
                val referencedMessage =
                    chatMessageRepository
                        .findById(referencedMessageId)
                        .orElseThrow { IllegalArgumentException("Referenced message not found") }
                require(referencedMessage.collectiveCode == collectiveCode) { "Referenced message not found" }
                require(referencedMessage.recipient == null) { "Referenced message not found" }
                require(!chatMessageRepository.existsByReplyToMessageId(referencedMessage.id)) { "Message already has a reply" }
                referencedMessage.id
            }
        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = actorName,
                    collectiveCode = collectiveCode,
                    text = normalizedText,
                    replyToMessageId = replyToMessageId,
                    timestamp = LocalDateTime.now(),
                ),
            )

        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_CREATED", dto)
        notifyOtherMembers(collectiveCode, actorName, normalizedText, "NEW_MESSAGE")
        return dto
    }

    @Transactional
    fun createImageMessage(
        image: MultipartFile,
        caption: String?,
        actorName: String,
    ): MessageDto {
        require(!image.isEmpty) { "Image is required" }
        val contentType =
            image.contentType
                ?.trim()
                .orEmpty()
                .lowercase()
        require(contentType.startsWith("image/")) { "Only image uploads are supported" }
        require(image.size <= maxChatImageBytes) { "Image is too large (max 5 MB)" }

        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val normalizedCaption = caption?.trim().orEmpty()
        val payload = Base64.getEncoder().encodeToString(image.bytes)

        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = actorName,
                    collectiveCode = collectiveCode,
                    text = normalizedCaption,
                    imageData = payload,
                    imageMimeType = contentType,
                    imageFileName = image.originalFilename?.take(255),
                    timestamp = LocalDateTime.now(),
                ),
            )

        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_CREATED", dto)
        val previewText = if (normalizedCaption.isNotBlank()) normalizedCaption else "[Image]"
        notifyOtherMembers(collectiveCode, actorName, previewText, "NEW_MESSAGE")
        return dto
    }

    @Transactional
    fun addReaction(
        messageId: Long,
        emoji: String,
        actorName: String,
    ): MessageDto {
        require(emoji in allowedReactionEmojis) { "Unsupported reaction" }

        val message =
            chatMessageRepository
                .findById(messageId)
                .orElseThrow { IllegalArgumentException("Message not found") }

        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        require(message.collectiveCode == collectiveCode) { "Message not found" }
        // Household messages: any collective member may react. DM messages: only the two
        // participants — a third household member reacting to someone else's private message
        // would leak that the message exists at all.
        if (message.recipient != null) {
            require(message.sender == actorName || message.recipient == actorName) { "Message not found" }
        }

        val reactions =
            message
                .reactionMap()
                .mapValues { (_, users) -> users.toMutableSet() }
                .toMutableMap()

        reactions.values.forEach { users -> users.remove(actorName) }
        reactions.entries.removeIf { (_, users) -> users.isEmpty() }

        val users = reactions.getOrPut(emoji) { mutableSetOf() }
        users.add(actorName)

        val updated =
            chatMessageRepository.save(
                message.copy(reactions = objectMapper.writeValueAsString(reactions.toJsonMap())),
            )

        val dto = updated.toDto()
        publishMessageUpdate(collectiveCode, updated, "MESSAGE_REACTION_UPDATED", dto)
        return dto
    }

    @Transactional
    fun removeReaction(
        messageId: Long,
        emoji: String,
        actorName: String,
    ): MessageDto {
        require(emoji in allowedReactionEmojis) { "Unsupported reaction" }

        val message =
            chatMessageRepository
                .findById(messageId)
                .orElseThrow { IllegalArgumentException("Message not found") }

        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        require(message.collectiveCode == collectiveCode) { "Message not found" }
        if (message.recipient != null) {
            require(message.sender == actorName || message.recipient == actorName) { "Message not found" }
        }

        val reactions = message.reactionMap().toMutableMap()
        val users = reactions[emoji]?.toMutableSet() ?: mutableSetOf()
        users.remove(actorName)

        if (users.isEmpty()) {
            reactions.remove(emoji)
        } else {
            reactions[emoji] = users
        }

        val updated =
            chatMessageRepository.save(
                message.copy(reactions = objectMapper.writeValueAsString(reactions.toJsonMap())),
            )

        val dto = updated.toDto()
        publishMessageUpdate(collectiveCode, updated, "MESSAGE_REACTION_UPDATED", dto)
        return dto
    }

    @Transactional
    fun createPoll(
        request: CreatePollRequest,
        actorName: String,
    ): MessageDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)

        val question = request.question.trim()
        require(question.isNotBlank()) { "Poll question is required" }

        val options =
            request.options
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .distinct()
        require(options.size in 2..6) { "Poll must have between 2 and 6 unique options" }

        val payload =
            PollPayload(
                question = question,
                options =
                    options.mapIndexed { index, text ->
                        PollOptionPayload(id = index, text = text, users = emptyList())
                    },
            )

        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = actorName,
                    collectiveCode = collectiveCode,
                    text = "📊 $question",
                    timestamp = LocalDateTime.now(),
                    poll = objectMapper.writeValueAsString(payload),
                ),
            )

        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_CREATED", dto)
        notifyOtherMembers(collectiveCode, actorName, "📊 $question", "NEW_MESSAGE")
        return dto
    }

    @Transactional
    fun votePoll(
        messageId: Long,
        optionId: Int,
        actorName: String,
    ): MessageDto {
        val message =
            chatMessageRepository
                .findById(messageId)
                .orElseThrow { IllegalArgumentException("Message not found") }

        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        require(message.collectiveCode == collectiveCode) { "Message not found" }
        require(message.recipient == null) { "Message not found" }

        val poll = message.pollPayload() ?: throw IllegalArgumentException("Message is not a poll")
        require(poll.options.any { it.id == optionId }) { "Invalid poll option" }

        val updatedOptions =
            poll.options.map { option ->
                val usersWithoutActor = option.users.filter { it != actorName }
                if (option.id == optionId) {
                    option.copy(users = (usersWithoutActor + actorName).distinct().sorted())
                } else {
                    option.copy(users = usersWithoutActor.sorted())
                }
            }

        val updated =
            chatMessageRepository.save(
                message.copy(
                    poll = objectMapper.writeValueAsString(poll.copy(options = updatedOptions)),
                ),
            )

        val dto = updated.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_POLL_UPDATED", dto)
        return dto
    }

    // #7 Pinned announcement: at most one message is pinned per collective, so important
    // notices (landlord visit, bills due) don't scroll away. Pinning replaces any prior pin.
    @Transactional
    fun togglePin(
        messageId: Long,
        actorName: String,
    ): MessageDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val message =
            chatMessageRepository
                .findById(messageId)
                .orElseThrow { IllegalArgumentException("Message not found") }
        require(message.collectiveCode == collectiveCode) { "Message not found" }
        require(message.recipient == null) { "Message not found" }

        val nowPinned = !message.pinned
        if (nowPinned) {
            chatMessageRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.pinned && it.id != messageId }
                .forEach { chatMessageRepository.save(it.copy(pinned = false)) }
        }
        val updated = chatMessageRepository.save(message.copy(pinned = nowPinned))
        val dto = updated.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_PINNED", dto)
        return dto
    }

    // A system-style notice posted into the household chat (e.g. a violation report). Saved and
    // broadcast like a normal message, but without NEW_MESSAGE notifications because the caller
    // sends its own targeted notifications for the event.
    @Transactional
    fun postHouseholdNotice(
        collectiveCode: String,
        sender: String,
        text: String,
    ): MessageDto {
        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = sender,
                    collectiveCode = collectiveCode,
                    text = text,
                    timestamp = LocalDateTime.now(),
                ),
            )
        val dto = saved.toDto()
        realtimeUpdateService.publish(collectiveCode, "MESSAGE_CREATED", dto)
        return dto
    }

    // A system-style notice sent as a private DM (e.g. a violation report aimed at one member).
    // Saved and pushed like a normal direct message, but without a NEW_MESSAGE notification because
    // the caller sends its own targeted notification for the event.
    @Transactional
    fun postDirectNotice(
        collectiveCode: String,
        recipient: String,
        senderLabel: String,
        text: String,
    ): MessageDto {
        val saved =
            chatMessageRepository.save(
                ChatMessage(
                    sender = senderLabel,
                    collectiveCode = collectiveCode,
                    recipient = recipient,
                    text = text,
                    timestamp = LocalDateTime.now(),
                ),
            )
        val dto = saved.toDto()
        realtimeUpdateService.publishToMembers(collectiveCode, setOf(recipient), "DIRECT_MESSAGE_CREATED", dto)
        return dto
    }

    private fun notifyOtherMembers(
        collectiveCode: String,
        sender: String,
        text: String,
        type: String,
    ) {
        val others =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.status == MemberStatus.ACTIVE && it.name != sender }
                .map { it.name }
        if (others.isEmpty()) return
        val preview = if (text.length > 60) text.take(60) + "..." else text
        notificationService.createParameterizedGroupNotification(
            userNames = others,
            type = type,
            params = mapOf("sender" to sender, "preview" to preview),
        )
    }

    private data class PollPayload(
        val question: String,
        val options: List<PollOptionPayload>,
    )

    private data class PollOptionPayload(
        val id: Int,
        val text: String,
        val users: List<String> = emptyList(),
    )

    private fun ChatMessage.reactionMap(): Map<String, Set<String>> {
        if (reactions.isBlank()) return emptyMap()
        return try {
            objectMapper.readValue<Map<String, Set<String>>>(reactions)
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun ChatMessage.pollPayload(): PollPayload? {
        val raw = poll?.trim().orEmpty()
        if (raw.isBlank()) return null
        return try {
            objectMapper.readValue<PollPayload>(raw)
        } catch (_: Exception) {
            null
        }
    }

    private fun Map<String, Set<String>>.toJsonMap(): Map<String, List<String>> = mapValues { (_, value) -> value.toList().sorted() }

    private fun ChatMessage.toDto() =
        MessageDto(
            id = id,
            sender = sender,
            recipient = recipient,
            text = text,
            imageData = imageData,
            imageMimeType = imageMimeType,
            imageFileName = imageFileName,
            replyToMessageId = replyToMessageId,
            timestamp = timestamp,
            reactions =
                reactionMap()
                    .map { (emoji, users) -> ReactionDto(emoji, users.toList().sorted()) }
                    .sortedBy { it.emoji },
            poll =
                pollPayload()?.let { payload ->
                    PollDto(
                        question = payload.question,
                        options =
                            payload.options
                                .sortedBy { it.id }
                                .map { PollOptionDto(id = it.id, text = it.text, users = it.users.sorted()) },
                    )
                },
            pinned = pinned,
        )

    companion object {
        // Display name used as the chat sender (and notification reporter) when a violation is
        // reported anonymously, so it reads as an automated household notice rather than a person.
        // Not a real Member row — getDirectMessages/getThreadSummaries both special-case it.
        const val SYSTEM_SENDER = "Kollekt Bot 🤖"
    }
}
