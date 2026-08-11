package com.kollekt.service

import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Base64

class ImageSafetyServiceTest {
    private lateinit var gateway: ImageModerationGateway
    private lateinit var usageTracker: VisionApiUsageTracker

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
            service().validateAndModerate("photo".toByteArray(), "image/jpeg")
        }
    }

    @Test
    fun `rejects an image the gateway flags`() {
        whenever(gateway.review(any())).thenReturn(ModerationVerdict.REJECTED)

        assertThrows<ImageRejectedException> {
            service().validateAndModerate("photo".toByteArray(), "image/png")
        }
    }

    @Test
    fun `rejects when the gateway can't be reached rather than allowing the upload`() {
        whenever(gateway.review(any())).thenThrow(ModerationUnavailableException("down"))

        assertThrows<ImageModerationUnavailableException> {
            service().validateAndModerate("photo".toByteArray(), "image/png")
        }
    }

    @Test
    fun `rejects a disallowed content type before ever calling the gateway`() {
        assertThrows<IllegalArgumentException> {
            service().validateAndModerate("<svg></svg>".toByteArray(), "image/svg+xml")
        }
        verify(gateway, never()).review(any())
    }

    @Test
    fun `rejects an oversize image before ever calling the gateway`() {
        val oversize = ByteArray((ImageSafetyService.MAX_IMAGE_BYTES + 1).toInt())

        assertThrows<IllegalArgumentException> {
            service().validateAndModerate(oversize, "image/png")
        }
        verify(gateway, never()).review(any())
    }

    @Test
    fun `disabled moderation skips the gateway entirely — local dev opt-out only`() {
        assertDoesNotThrow {
            service(enabled = false).validateAndModerate("photo".toByteArray(), "image/jpeg")
        }
        verify(gateway, never()).review(any())
    }

    @Test
    fun `base64 variant decodes then applies the same checks`() {
        whenever(gateway.review(any())).thenReturn(ModerationVerdict.ALLOWED)
        val encoded = Base64.getEncoder().encodeToString("photo".toByteArray())

        assertDoesNotThrow {
            service().validateAndModerateBase64(encoded, "image/jpeg")
        }
    }

    @Test
    fun `allows the upload without calling the gateway once the monthly call limit is reached`() {
        whenever(usageTracker.tryConsumeCall(any())).thenReturn(false)

        assertDoesNotThrow {
            service().validateAndModerate("photo".toByteArray(), "image/jpeg")
        }
        verify(gateway, never()).review(any())
    }

    @Test
    fun `allows the upload when no credentials are configured, instead of breaking every upload`() {
        whenever(gateway.isConfigured()).thenReturn(false)

        assertDoesNotThrow {
            service().validateAndModerate("photo".toByteArray(), "image/jpeg")
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
