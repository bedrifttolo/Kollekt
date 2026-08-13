package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.domain.PushDeviceToken
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PushDeviceTokenRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Instant

class AppUpdatePushServiceTest {
    private lateinit var pushDeviceTokenRepository: PushDeviceTokenRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var apnsGateway: ApnsGateway
    private lateinit var fcmGateway: FcmGateway
    private lateinit var service: AppUpdatePushService

    @BeforeEach
    fun setUp() {
        pushDeviceTokenRepository = mock()
        memberRepository = mock()
        apnsGateway = mock()
        fcmGateway = mock()
        service =
            AppUpdatePushService(
                pushDeviceTokenRepository,
                memberRepository,
                apnsGateway,
                fcmGateway,
                latestIosVersion = "1.1",
                latestAndroidVersion = "0",
            )
    }

    @Test
    fun `a dry run reports the candidate count and sends nothing`() {
        whenever(pushDeviceTokenRepository.findByPlatformAndAppUpdatePushSentAtIsNull("ios")).thenReturn(
            listOf(deviceToken("token-1", "Kasper"), deviceToken("token-2", "Emma")),
        )

        val result = service.sendAppUpdatePush("ios", dryRun = true)

        assertEquals(AppUpdatePushResult("ios", candidates = 2, sent = 0), result)
        verify(apnsGateway, never()).sendAlert(any(), any(), any(), any())
        verify(pushDeviceTokenRepository, never()).save(any())
    }

    @Test
    fun `sends one localized alert per candidate device and stamps each as sent`() {
        whenever(pushDeviceTokenRepository.findByPlatformAndAppUpdatePushSentAtIsNull("ios")).thenReturn(
            listOf(deviceToken("token-1", "Kasper"), deviceToken("token-2", "Emma")),
        )
        whenever(memberRepository.findAllByName("Kasper")).thenReturn(listOf(member("Kasper", "no")))
        whenever(memberRepository.findAllByName("Emma")).thenReturn(listOf(member("Emma", "en")))

        val result = service.sendAppUpdatePush("ios", dryRun = false)

        assertEquals(AppUpdatePushResult("ios", candidates = 2, sent = 2), result)
        // Empty route: old builds navigate on any route starting with "/", which would reload the
        // webview. The tap should just open the app.
        verify(apnsGateway).sendAlert(
            "token-1",
            "Ny versjon av Kollekt",
            "Kollekt 1.1 er ute. Åpne App Store for å sjekke at du har den nyeste versjonen.",
            "",
        )
        verify(apnsGateway).sendAlert(
            "token-2",
            "New Kollekt version",
            "Kollekt 1.1 is out. Open App Store to make sure you have the newest version.",
            "",
        )

        val saved = argumentCaptor<PushDeviceToken>()
        verify(pushDeviceTokenRepository, org.mockito.kotlin.times(2)).save(saved.capture())
        saved.allValues.forEach { assertNotNull(it.appUpdatePushSentAt) }
    }

    @Test
    fun `already-stamped devices never reach the query, so a repeat run sends nothing`() {
        whenever(pushDeviceTokenRepository.findByPlatformAndAppUpdatePushSentAtIsNull("ios"))
            .thenReturn(emptyList())

        val result = service.sendAppUpdatePush("ios", dryRun = false)

        assertEquals(AppUpdatePushResult("ios", candidates = 0, sent = 0), result)
        verify(apnsGateway, never()).sendAlert(any(), any(), any(), any())
    }

    @Test
    fun `falls back to norwegian when the member has no stored language`() {
        whenever(pushDeviceTokenRepository.findByPlatformAndAppUpdatePushSentAtIsNull("ios")).thenReturn(
            listOf(deviceToken("token-1", "Kasper")),
        )
        whenever(memberRepository.findAllByName("Kasper")).thenReturn(listOf(member("Kasper", null)))

        service.sendAppUpdatePush("ios", dryRun = false)

        verify(apnsGateway).sendAlert(
            "token-1",
            "Ny versjon av Kollekt",
            "Kollekt 1.1 er ute. Åpne App Store for å sjekke at du har den nyeste versjonen.",
            "",
        )
    }

    @Test
    fun `refuses to broadcast for a platform with no live version configured`() {
        assertThrows<IllegalArgumentException> { service.sendAppUpdatePush("android", dryRun = true) }

        verify(fcmGateway, never()).sendAlert(any(), any(), any(), any())
        verify(pushDeviceTokenRepository, never()).findByPlatformAndAppUpdatePushSentAtIsNull(any())
    }

    @Test
    fun `rejects an unknown platform`() {
        assertThrows<IllegalArgumentException> { service.sendAppUpdatePush("web", dryRun = true) }
    }

    @Test
    fun `routes android devices through fcm with play store copy`() {
        val androidService =
            AppUpdatePushService(
                pushDeviceTokenRepository,
                memberRepository,
                apnsGateway,
                fcmGateway,
                latestIosVersion = "1.1",
                latestAndroidVersion = "1.2",
            )
        whenever(pushDeviceTokenRepository.findByPlatformAndAppUpdatePushSentAtIsNull("android")).thenReturn(
            listOf(deviceToken("android-token", "Emma", platform = "android")),
        )
        whenever(memberRepository.findAllByName("Emma")).thenReturn(listOf(member("Emma", "en")))

        androidService.sendAppUpdatePush("android", dryRun = false)

        verify(fcmGateway).sendAlert(
            "android-token",
            "New Kollekt version",
            "Kollekt 1.2 is out. Open Google Play to make sure you have the newest version.",
            "",
        )
        verify(apnsGateway, never()).sendAlert(any(), any(), any(), any())
    }

    private fun deviceToken(
        token: String,
        memberName: String,
        platform: String = "ios",
    ) = PushDeviceToken(token = token, memberName = memberName, platform = platform, updatedAt = Instant.now())

    private fun member(
        name: String,
        language: String?,
    ) = Member(name = name, email = "$name@example.com", language = language)
}
