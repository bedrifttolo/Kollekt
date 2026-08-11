package com.kollekt.service

import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.awt.image.BufferedImage
import java.util.Base64
import javax.imageio.ImageIO

class ImageSafetyServiceTest {
    private lateinit var gateway: ImageModerationGateway
    private lateinit var usageTracker: VisionApiUsageTracker

    // The format is now sniffed from the file's own header, so fixtures need real magic bytes.
    private fun jpeg(payloadSize: Int = 16) = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()) + ByteArray(payloadSize)

    private fun png(payloadSize: Int = 16) = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) + ByteArray(payloadSize)

    private fun service(
        enabled: Boolean = true,
        monthlyCallLimit: Int = 1000,
    ) = ImageSafetyService(enabled, monthlyCallLimit, gateway, usageTracker)

    @BeforeEach
    fun setUp() {
        gateway = mock()
        usageTracker = mock()
        whenever(gateway.isConfigured()).thenReturn(true)
        whenever(usageTracker.tryConsumeCall(any())).thenReturn(true)
    }

    @Test
    fun `allows an image the gateway approves`() {
        whenever(gateway.review(any())).thenReturn(ModerationVerdict.ALLOWED)

        assertDoesNotThrow {
            service().validateAndModerate(jpeg(), "image/jpeg")
        }
    }

    @Test
    fun `rejects an image the gateway flags`() {
        whenever(gateway.review(any())).thenReturn(ModerationVerdict.REJECTED)

        assertThrows<ImageRejectedException> {
            service().validateAndModerate(png(), "image/png")
        }
    }

    @Test
    fun `rejects when the gateway can't be reached rather than allowing the upload`() {
        whenever(gateway.review(any())).thenThrow(ModerationUnavailableException("down"))

        assertThrows<ImageModerationUnavailableException> {
            service().validateAndModerate(png(), "image/png")
        }
    }

    @Test
    fun `rejects SVG even when a client labels it as an allowed type`() {
        // SVG is a script-bearing XML document, so it must never be sniffed as an image — and
        // claiming image/png in the header must not get it in either.
        assertThrows<IllegalArgumentException> {
            service().validateAndModerate("<svg></svg>".toByteArray(), "image/png")
        }
        verify(gateway, never()).review(any())
    }

    @Test
    fun `trusts the file's magic bytes over a wrong declared content type`() {
        whenever(gateway.review(any())).thenReturn(ModerationVerdict.ALLOWED)

        // A picker mislabelling an ordinary JPEG used to be an outright rejection.
        val result = service().validateAndModerate(jpeg(), "application/octet-stream")

        assertEquals("image/jpeg", result.mimeType)
    }

    @Test
    fun `accepts a real oversize photo by downscaling it instead of rejecting it`() {
        whenever(gateway.review(any())).thenReturn(ModerationVerdict.ALLOWED)
        val huge = realJpegOver(ImageSafetyService.MAX_IMAGE_BYTES)

        val result = service().validateAndModerate(huge, "image/jpeg")

        assertEquals("image/jpeg", result.mimeType)
        assertTrue(result.bytes.size <= ImageSafetyService.MAX_IMAGE_BYTES, "still over the cap after downscaling")
        assertTrue(result.bytes.size < huge.size, "downscaling did not shrink the payload")
        // Moderation sees the re-encoded bytes, not the original.
        verify(gateway).review(argThat { size == result.bytes.size })
    }

    @Test
    fun `downscaled image keeps a decodable JPEG within the pixel limit`() {
        whenever(gateway.review(any())).thenReturn(ModerationVerdict.ALLOWED)

        val result = service().validateAndModerate(realJpegOver(ImageSafetyService.MAX_IMAGE_BYTES), "image/jpeg")

        val decoded = ImageIO.read(java.io.ByteArrayInputStream(result.bytes))
        assertNotNull(decoded)
        assertTrue(
            maxOf(decoded.width, decoded.height) <= ImageSafetyService.MAX_EDGE_PIXELS,
            "long edge ${maxOf(decoded.width, decoded.height)} exceeds the limit",
        )
    }

    /** A genuinely decodable JPEG larger than [minBytes] — noise so it doesn't compress away. */
    private fun realJpegOver(minBytes: Long): ByteArray {
        var edge = 3000
        while (true) {
            val image = BufferedImage(edge, edge, BufferedImage.TYPE_INT_RGB)
            val random = java.util.Random(42)
            for (x in 0 until edge) {
                for (y in 0 until edge) image.setRGB(x, y, random.nextInt())
            }
            val out = java.io.ByteArrayOutputStream()
            ImageIO.write(image, "jpeg", out)
            if (out.size() > minBytes) return out.toByteArray()
            edge = (edge * 1.5).toInt()
        }
    }

    @Test
    fun `rejects an oversize image it cannot decode, before ever calling the gateway`() {
        // PNG header but junk body: nothing to downscale, so the size limit is the last word.
        val oversize = png((ImageSafetyService.MAX_IMAGE_BYTES + 1).toInt())

        assertThrows<IllegalArgumentException> {
            service().validateAndModerate(oversize, "image/png")
        }
        verify(gateway, never()).review(any())
    }

    @Test
    fun `disabled moderation skips the gateway entirely — local dev opt-out only`() {
        assertDoesNotThrow {
            service(enabled = false).validateAndModerate(jpeg(), "image/jpeg")
        }
        verify(gateway, never()).review(any())
    }

    @Test
    fun `base64 variant decodes then applies the same checks`() {
        whenever(gateway.review(any())).thenReturn(ModerationVerdict.ALLOWED)
        val encoded = Base64.getEncoder().encodeToString(jpeg())

        assertDoesNotThrow {
            service().validateAndModerateBase64(encoded, "image/jpeg")
        }
    }

    @Test
    fun `allows the upload without calling the gateway once the monthly call limit is reached`() {
        whenever(usageTracker.tryConsumeCall(any())).thenReturn(false)

        assertDoesNotThrow {
            service().validateAndModerate(jpeg(), "image/jpeg")
        }
        verify(gateway, never()).review(any())
    }

    @Test
    fun `allows the upload when no credentials are configured, instead of breaking every upload`() {
        whenever(gateway.isConfigured()).thenReturn(false)

        assertDoesNotThrow {
            service().validateAndModerate(jpeg(), "image/jpeg")
        }
        verify(gateway, never()).review(any())
        // The call budget is for real Vision calls only — an unconfigured gateway makes none.
        verify(usageTracker, never()).tryConsumeCall(any())
    }

    @Test
    fun `an unconfigured gateway still enforces the type and size limits`() {
        whenever(gateway.isConfigured()).thenReturn(false)

        assertThrows<IllegalArgumentException> {
            service().validateAndModerate("<svg></svg>".toByteArray(), "image/svg+xml")
        }
    }

    @Test
    fun `base64 variant rejects data that isn't valid base64`() {
        assertThrows<IllegalArgumentException> {
            service().validateAndModerateBase64("not-base64!!!", "image/jpeg")
        }
    }
}
