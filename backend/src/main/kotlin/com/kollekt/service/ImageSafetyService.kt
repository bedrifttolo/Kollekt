package com.kollekt.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.Base64
import javax.imageio.ImageIO

/** The upload was rejected by content moderation. */
class ImageRejectedException : RuntimeException("This photo can't be shared.")

/** Moderation couldn't be run (provider unreachable/misconfigured) — the caller should retry, not assume safety. */
class ImageModerationUnavailableException : RuntimeException("Couldn't check this photo right now. Please try again.")

/**
 * An upload that passed every check, in the form it should actually be stored in — which is not
 * necessarily the form it arrived in, since oversized photos are re-encoded rather than rejected.
 */
data class SafeImage(
    val bytes: ByteArray,
    val mimeType: String,
) {
    // ByteArray uses identity equality, which would make this data class's generated equals/hashCode
    // quietly wrong. Compare contents instead.
    override fun equals(other: Any?): Boolean =
        this === other ||
            (other is SafeImage && mimeType == other.mimeType && bytes.contentEquals(other.bytes))

    override fun hashCode(): Int = 31 * bytes.contentHashCode() + mimeType.hashCode()
}

/**
 * Single gate every image upload (chat images, task feedback photos, task completion photos)
 * must pass through before it is persisted or delivered to another member.
 *
 * Two things it deliberately does *not* do is reject an upload for being too big, or for what the
 * client claimed its `Content-Type` was. Both were doing exactly that, and between them they broke
 * photo sending outright: a full-resolution phone photo clears [MAX_IMAGE_BYTES] on its own, and
 * the declared MIME type is client-supplied metadata that browsers, pickers and Capacitor all
 * report differently. Instead the format is [detectFormat]ed from the file's own magic bytes, and
 * anything over the limit is downscaled to [MAX_EDGE_PIXELS] and re-encoded as JPEG. Only an
 * upload that is not a recognisable image, or that is still too big after re-encoding (i.e. a
 * format the JVM can't decode, such as HEIC), is refused.
 *
 * Moderation itself still fails closed: a REJECTED verdict or a configured-but-unreachable
 * provider blocks the upload. [enabled] exists only as an explicit local-dev opt-out
 * (`APP_MODERATION_ENABLED=false`) — it must never be silently false in production.
 *
 * Two deliberate exceptions to fail-closed, both of which trade a known, bounded moderation gap
 * for uploads that keep working:
 *  - The gateway has no credentials at all ([ImageModerationGateway.isConfigured] is false).
 *    Blocking here meant a deployment that hadn't set `GOOGLE_CLOUD_VISION_API_KEY` yet had
 *    *every* photo upload in the app permanently broken with a 503.
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

        /**
         * Ceiling on what gets stored and sent to Vision. Google's SafeSearch endpoint takes the
         * image base64-encoded inside a JSON body, which inflates it ~33%, so this stays well
         * under their 10 MB request limit.
         */
        const val MAX_IMAGE_BYTES = 5 * 1024 * 1024L

        /** Longest edge, in pixels, that an oversized upload is downscaled to before re-encoding. */
        const val MAX_EDGE_PIXELS = 1600

        private const val JPEG_QUALITY = 0.82f

        /** Formats the JVM's ImageIO can decode, and can therefore rescue when they're oversized. */
        private val TRANSCODABLE = setOf("image/jpeg", "image/png", "image/gif")
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

    /**
     * Validates, downscales if needed, and moderates an upload.
     *
     * @param declaredMimeType what the client said it was; used only as a fallback when the bytes
     *   themselves aren't recognisable, never as the authority.
     * @return the bytes and MIME type the caller should persist — re-encoded if the original was
     *   over [MAX_IMAGE_BYTES].
     */
    fun validateAndModerate(
        bytes: ByteArray,
        declaredMimeType: String,
    ): SafeImage {
        require(bytes.isNotEmpty()) { "Image is required" }

        // The file's own header is the ONLY authority. A picker mislabelling a perfectly ordinary
        // JPEG used to be an outright rejection; conversely, falling back to the declared type when
        // sniffing fails would let any payload in under a claimed `image/png` — including SVG,
        // which is a script-bearing XML document rather than a raster image. [detectFormat] already
        // recognises every type in [ALLOWED_MIME_TYPES], so there is nothing for a fallback to
        // rescue. `declaredMimeType` is kept only for the log line below.
        val format = detectFormat(bytes)
        requireNotNull(format) {
            log.debug("Rejected an upload declared as '{}' whose bytes are not a supported image", declaredMimeType)
            "Only JPEG, PNG, WEBP, HEIC/HEIF or GIF images are supported"
        }

        val safe = shrinkIfNeeded(bytes, format)
        require(safe.bytes.size <= MAX_IMAGE_BYTES) { "Image is too large (max 5 MB)" }

        moderate(safe.bytes)
        return safe
    }

    /** For the base64 upload paths (task feedback/completion photos). */
    fun validateAndModerateBase64(
        base64Data: String,
        declaredMimeType: String,
    ): SafeImageBase64 {
        val bytes =
            try {
                Base64.getDecoder().decode(base64Data)
            } catch (ex: IllegalArgumentException) {
                throw IllegalArgumentException("Image data is not valid base64")
            }
        val safe = validateAndModerate(bytes, declaredMimeType)
        return SafeImageBase64(Base64.getEncoder().encodeToString(safe.bytes), safe.mimeType)
    }

    private fun moderate(bytes: ByteArray) {
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

    /**
     * Downscales an over-limit image to [MAX_EDGE_PIXELS] and re-encodes it as JPEG. Returns the
     * input untouched when it's already small enough, or when the format isn't one ImageIO can
     * decode (HEIC/WEBP) — those then fall to the size check, which is the only case left where an
     * upload is refused for being too big.
     */
    private fun shrinkIfNeeded(
        bytes: ByteArray,
        format: String,
    ): SafeImage {
        if (bytes.size <= MAX_IMAGE_BYTES) return SafeImage(bytes, format)
        if (format !in TRANSCODABLE) {
            log.warn("Image of {} bytes is over the limit and {} can't be transcoded here", bytes.size, format)
            return SafeImage(bytes, format)
        }

        return try {
            val source = ImageIO.read(ByteArrayInputStream(bytes)) ?: return SafeImage(bytes, format)
            val scale = MAX_EDGE_PIXELS.toDouble() / maxOf(source.width, source.height)
            val target =
                if (scale >= 1.0) {
                    source
                } else {
                    val width = (source.width * scale).toInt().coerceAtLeast(1)
                    val height = (source.height * scale).toInt().coerceAtLeast(1)
                    // TYPE_INT_RGB because the output is JPEG, which has no alpha channel — drawing
                    // a transparent PNG straight to an ARGB buffer then encoding it as JPEG is what
                    // produces the classic red-tinted image.
                    BufferedImage(width, height, BufferedImage.TYPE_INT_RGB).also {
                        val g = it.createGraphics()
                        g.drawImage(source.getScaledInstance(width, height, java.awt.Image.SCALE_SMOOTH), 0, 0, null)
                        g.dispose()
                    }
                }
            val jpeg = encodeJpeg(target)
            log.info("Downscaled a {} byte {} upload to {} bytes of JPEG", bytes.size, format, jpeg.size)
            SafeImage(jpeg, "image/jpeg")
        } catch (ex: Exception) {
            // A corrupt or exotic file: leave it alone and let the size check decide.
            log.warn("Could not downscale an oversized {} upload", format, ex)
            SafeImage(bytes, format)
        }
    }

    private fun encodeJpeg(image: BufferedImage): ByteArray {
        val writer =
            ImageIO.getImageWritersByFormatName("jpeg").next()
                ?: error("No JPEG writer available")
        return ByteArrayOutputStream().use { out ->
            ImageIO.createImageOutputStream(out).use { stream ->
                writer.output = stream
                val params =
                    writer.defaultWriteParam.apply {
                        compressionMode = javax.imageio.ImageWriteParam.MODE_EXPLICIT
                        compressionQuality = JPEG_QUALITY
                    }
                writer.write(null, javax.imageio.IIOImage(image, null, null), params)
            }
            writer.dispose()
            out.toByteArray()
        }
    }

    /**
     * Identifies an image from its magic bytes. Deliberately does not recognise SVG: it is an XML
     * document that can carry script, so it must never be accepted as an image regardless of what
     * a client labels it.
     */
    private fun detectFormat(bytes: ByteArray): String? {
        fun at(
            offset: Int,
            vararg expected: Int,
        ): Boolean =
            bytes.size >= offset + expected.size &&
                expected.withIndex().all { (i, b) -> bytes[offset + i].toInt() and 0xFF == b }

        return when {
            at(0, 0xFF, 0xD8, 0xFF) -> "image/jpeg"
            at(0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) -> "image/png"
            at(0, 0x47, 0x49, 0x46, 0x38) -> "image/gif"
            // RIFF....WEBP
            at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50) -> "image/webp"
            // ISO-BMFF box: ....ftyp<brand>, where the brand distinguishes HEIC from HEIF.
            at(4, 0x66, 0x74, 0x79, 0x70) -> heicBrand(bytes)
            else -> null
        }
    }

    private fun heicBrand(bytes: ByteArray): String? {
        if (bytes.size < 12) return null
        return when (String(bytes, 8, 4, Charsets.ISO_8859_1)) {
            "heic", "heix", "hevc", "hevx" -> "image/heic"
            "mif1", "msf1", "heim", "heis" -> "image/heif"
            else -> null
        }
    }
}

/** [SafeImage] in the base64 form the task-photo columns store. */
data class SafeImageBase64(
    val data: String,
    val mimeType: String,
)
