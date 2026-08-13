package com.kollekt.api

import com.kollekt.service.AppUpdatePushResult
import com.kollekt.service.AppUpdatePushService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

class AdminPushControllerTest {
    private val appUpdatePushService: AppUpdatePushService = mock()

    @Test
    fun `404s when no admin token is configured, so the endpoint is off by default`() {
        val controller = AdminPushController(adminToken = "", appUpdatePushService)

        val ex =
            assertThrows<ResponseStatusException> {
                controller.sendAppUpdatePush(token = "anything", platform = "ios", dryRun = true)
            }

        assertEquals(HttpStatus.NOT_FOUND, ex.statusCode)
        verify(appUpdatePushService, never()).sendAppUpdatePush(any(), any())
    }

    @Test
    fun `404s rather than 403s on a wrong token, so it does not confirm the endpoint exists`() {
        val controller = AdminPushController(adminToken = "correct-secret", appUpdatePushService)

        val ex =
            assertThrows<ResponseStatusException> {
                controller.sendAppUpdatePush(token = "wrong-secret", platform = "ios", dryRun = true)
            }

        assertEquals(HttpStatus.NOT_FOUND, ex.statusCode)
        verify(appUpdatePushService, never()).sendAppUpdatePush(any(), any())
    }

    @Test
    fun `delegates to the service when the token matches`() {
        val controller = AdminPushController(adminToken = "correct-secret", appUpdatePushService)
        whenever(appUpdatePushService.sendAppUpdatePush("ios", true))
            .thenReturn(AppUpdatePushResult("ios", candidates = 42, sent = 0))

        val result = controller.sendAppUpdatePush(token = "correct-secret", platform = "ios", dryRun = true)

        assertEquals(AppUpdatePushResult("ios", candidates = 42, sent = 0), result)
    }
}
