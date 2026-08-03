package com.kollekt.service

import com.kollekt.repository.PushDeviceTokenRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock

class PushyApnsGatewayTest {
    @Test
    fun `send alert is a safe no-op when apns is not configured`() {
        val gateway = PushyApnsGateway("", "", "", "no.kollekt.app", false, mock<PushDeviceTokenRepository>())

        val result = gateway.sendAlert("device-token", "Title", "Body", "/tasks")

        assertEquals(ApnsSendResult.FAILED, result)
    }
}
