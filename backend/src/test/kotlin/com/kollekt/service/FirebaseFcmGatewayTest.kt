package com.kollekt.service

import com.kollekt.repository.PushDeviceTokenRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock

class FirebaseFcmGatewayTest {
    @Test
    fun `send alert is a safe no-op when fcm is not configured`() {
        val gateway = FirebaseFcmGateway("", mock<PushDeviceTokenRepository>())

        val result = gateway.sendAlert("device-token", "Title", "Body", "/tasks")

        assertEquals(FcmSendResult.FAILED, result)
    }

    @Test
    fun `send alert is a safe no-op when the configured credentials are not valid json`() {
        val gateway = FirebaseFcmGateway("bm90LWpzb24=", mock<PushDeviceTokenRepository>())

        val result = gateway.sendAlert("device-token", "Title", "Body", "/tasks")

        assertEquals(FcmSendResult.FAILED, result)
    }
}
