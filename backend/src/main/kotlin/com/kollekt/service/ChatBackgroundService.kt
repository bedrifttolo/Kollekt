package com.kollekt.service

import com.kollekt.api.dto.ChatBackgroundDto
import com.kollekt.domain.ChatBackground
import com.kollekt.repository.ChatBackgroundRepository
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.time.Instant
import java.util.Base64

/**
 * The wallpaper behind a chat thread — one picture per thread, shared by everyone in it.
 *
 * It used to live in each device's localStorage, which meant "change the background" changed it for
 * exactly one person. It is a property of the conversation now, so setting it is visible to every
 * participant, and a [RealtimeUpdateService] event tells their open threads to refetch.
 */
@Service
class ChatBackgroundService(
    private val chatBackgroundRepository: ChatBackgroundRepository,
    private val memberRepository: MemberRepository,
    private val collectiveAccessService: CollectiveAccessService,
    private val imageSafetyService: ImageSafetyService,
    private val realtimeUpdateService: RealtimeUpdateService,
) {
    fun get(
        memberName: String,
        otherName: String?,
    ): ChatBackgroundDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val other = otherName?.let { requireHousemate(it, collectiveCode, memberName) }
        val stored = chatBackgroundRepository.findByCollectiveCodeAndThreadKey(collectiveCode, threadKey(memberName, other))
        return stored.toDto(other)
    }

    @Transactional
    fun set(
        memberName: String,
        otherName: String?,
        image: MultipartFile,
    ): ChatBackgroundDto {
        require(!image.isEmpty) { "Image is required" }
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val other = otherName?.let { requireHousemate(it, collectiveCode, memberName) }

        // Same sniff-downscale-moderate path chat image attachments go through: the multipart
        // Content-Type is a hint, the bytes are the authority.
        val safe = imageSafetyService.validateAndModerate(image.bytes, image.contentType.orEmpty())
        val encoded = Base64.getEncoder().encodeToString(safe.bytes)

        val key = threadKey(memberName, other)
        // Overwrite in place when the thread already has a wallpaper, so the unique constraint on
        // (collective_code, thread_key) is a guarantee rather than something to collide with.
        val saved =
            chatBackgroundRepository.save(
                chatBackgroundRepository
                    .findByCollectiveCodeAndThreadKey(collectiveCode, key)
                    ?.copy(
                        imageData = encoded,
                        imageMimeType = safe.mimeType,
                        setBy = memberName,
                        updatedAt = Instant.now(),
                    )
                    ?: ChatBackground(
                        collectiveCode = collectiveCode,
                        threadKey = key,
                        imageData = encoded,
                        imageMimeType = safe.mimeType,
                        setBy = memberName,
                    ),
            )

        publishChange(collectiveCode, memberName, other)
        return saved.toDto(other)
    }

    @Transactional
    fun clear(
        memberName: String,
        otherName: String?,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val other = otherName?.let { requireHousemate(it, collectiveCode, memberName) }
        chatBackgroundRepository.deleteByCollectiveCodeAndThreadKey(collectiveCode, threadKey(memberName, other))
        publishChange(collectiveCode, memberName, other)
    }

    /**
     * The notification is scoped exactly like the thread it describes: the household thread's
     * wallpaper is everyone's business, a direct thread's is only the two participants'. Payload
     * carries the participants rather than the opaque key so the client can match it against the
     * thread it has open without reimplementing [threadKey].
     */
    private fun publishChange(
        collectiveCode: String,
        memberName: String,
        other: String?,
    ) {
        if (other == null) {
            realtimeUpdateService.publish(
                collectiveCode,
                CHANGED_EVENT,
                mapOf("participants" to emptyList<String>(), "setBy" to memberName),
            )
        } else {
            realtimeUpdateService.publishToMembers(
                collectiveCode,
                setOf(memberName, other),
                CHANGED_EVENT,
                mapOf("participants" to listOf(memberName, other).sorted(), "setBy" to memberName),
            )
        }
    }

    private fun requireHousemate(
        otherName: String,
        collectiveCode: String,
        memberName: String,
    ): String {
        require(otherName != memberName) { "A direct thread needs two different members" }
        return memberRepository.findByNameAndCollectiveCode(otherName, collectiveCode)?.name
            ?: throw IllegalArgumentException("Member '$otherName' is not in your collective")
    }

    private fun ChatBackground?.toDto(other: String?) =
        ChatBackgroundDto(
            // A `data:` URL rather than a separate image endpoint, matching how chat attachments
            // already reach the client — one request, no second round trip to paint the thread.
            imageUrl = this?.let { "data:${it.imageMimeType};base64,${it.imageData}" },
            setBy = this?.setBy,
            updatedAt = this?.updatedAt,
            otherName = other,
        )

    companion object {
        const val CHANGED_EVENT = "CHAT_BACKGROUND_UPDATED"

        /**
         * Canonical key for a thread. The household thread is a constant; a direct thread sorts the
         * two names, so whichever participant sets the wallpaper both of them read the same row.
         */
        fun threadKey(
            memberName: String,
            otherName: String?,
        ): String =
            if (otherName == null) {
                "household"
            } else {
                val pair = listOf(memberName, otherName).sorted()
                "dm:${pair[0]}|${pair[1]}"
            }
    }
}
