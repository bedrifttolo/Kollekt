package com.kollekt.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.util.Base64

/** The upload was rejected by content moderation. */
class ImageRejectedException : RuntimeException("This photo can't be shared.")

/** Moderation couldn't be run (provider unreachable/misconfigured) — the caller should retry, not assume safety. */
class ImageModerationUnavailableException : RuntimeException("Couldn't check this photo right now. Please try again.")

/**
 * Single gate every image upload (chat images, task feedback photos, task completion photos)
 * must pass through before it is persisted or delivered to another member. Fails closed: a
 * disallowed type/size, a moderation REJECTED verdict, or the moderation provider being
 * configured-but-unreachable all block the upload. [enabled] exists only as an explicit local-dev
 * opt-out (`APP_MODERATION_ENABLED=false`) — it must never be silently false in production.
 *
 * Two deliberate exceptions to fail-closed, both of which trade a known, bounded moderation gap
 * for uploads that keep working:
 *  - The gateway has no credentials at all ([ImageModerationGateway.isConfigured] is false).
 *    Blocking here meant a deployment that hadn't set `GOOGLE_CLOUD_VISION_API_KEY` yet had
 *    *every* photo upload in the app permanently broken with a 503, which is how this surfaced.
 *  - [monthlyCallLimit] Vision API calls have already been made this calendar month, so further
 *    uploads skip the check rather than being blocked for the rest of the month, capping the
 *    Vision API bill at the free tier — see [usageTracker].
 */
@Service
class ImageSafetyService(
    @Value("\${app.moderation.enabled:true}") private val enabled: Boolean,
    @Value("\${app.moderation.monthly-call-limit:1000}") private val monthlyCallLimit: Int,
    private val gateway: ImageModerationGateway,
    private val usageTracker: VisionApiUsageTracker,
) {
    private val log = LoggerFactory.getLogger(ImageSafetyService::class.java)

    companion object {
        val ALLOWED_MIME_TYPES =
            setOf("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif")
        const val MAX_IMAGE_BYTES = 5 * 1024 * 1024L
    }

    init {
        if (!enabled) {
            log.warn("Image moderation is disabled (APP_MODERATION_ENABLED=false) — only use this for local development.")
        } else if (!gateway.isConfigured()) {
            log.warn(
                "Image moderation is enabled but has no credentials (GOOGLE_CLOUD_VISION_API_KEY unset) — " +
                    "uploads will be accepted WITHOUT a SafeSearch check. Set the key before shipping to production.",
            )
        }
    }

    fun validateAndModerate(
        bytes: ByteArray,
        mimeType: String,
    ) {
        val normalizedType = mimeType.trim().lowercase()
        require(normalizedType in ALLOWED_MIME_TYPES) { "Only JPEG, PNG, WEBP, HEIC/HEIF or GIF images are supported" }
        require(bytes.size <= MAX_IMAGE_BYTES) { "Image is too large (max 5 MB)" }

        if (!enabled) return

        // No credentials on this deployment: let the upload through rather than 503-ing every
        // photo in the app. Already warned about at startup; warned again here so a production
        // instance running unmoderated is loud in the logs rather than quietly permissive.
        if (!gateway.isConfigured()) {
            log.warn("Image moderation has no credentials configured; allowing upload without a SafeSearch check.")
            return
        }

        if (!usageTracker.tryConsumeCall(monthlyCallLimit)) {
            log.warn("Vision API monthly call limit ({}) reached; allowing upload without moderation.", monthlyCallLimit)
            return
        }

        val verdict =
            try {
                gateway.review(bytes)
            } catch (ex: ModerationUnavailableException) {
                log.warn("Image moderation unavailable; rejecting upload", ex)
                throw ImageModerationUnavailableException()
            }

        if (verdict == ModerationVerdict.REJECTED) {
            throw ImageRejectedException()
        }
    }

    /** For the base64 upload paths (task feedback/completion photos) — decodes then delegates to [validateAndModerate]. */
    fun validateAndModerateBase64(
        base64Data: String,
        mimeType: String,
    ) {
        val bytes =
            try {
                Base64.getDecoder().decode(base64Data)
            } catch (ex: IllegalArgumentException) {
                throw IllegalArgumentException("Image data is not valid base64")
            }
        validateAndModerate(bytes, mimeType)
    }
}
