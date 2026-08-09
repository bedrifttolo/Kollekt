package com.kollekt.service

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify

class PushDispatchServiceTest {
    private lateinit var apnsPushService: ApnsPushService
    private lateinit var fcmPushService: FcmPushService
    private lateinit var service: PushDispatchService

    @BeforeEach
    fun setUp() {
        apnsPushService = mock()
        fcmPushService = mock()
        service = PushDispatchService(apnsPushService, fcmPushService)
    }

    @Test
    fun `sends to both apns and fcm for every push, regardless of which platforms the member owns`() {
        val params = mapOf("title" to "Take out trash")

        service.sendPush("Kasper", "TASK_ASSIGNED", params)

        verify(apnsPushService).sendPush("Kasper", "TASK_ASSIGNED", params)
        verify(fcmPushService).sendPush("Kasper", "TASK_ASSIGNED", params)
    }
}
