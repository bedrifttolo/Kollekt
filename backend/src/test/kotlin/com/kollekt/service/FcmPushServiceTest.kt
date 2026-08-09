package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.domain.PushDeviceToken
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PushDeviceTokenRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Instant

class FcmPushServiceTest {
    private lateinit var pushDeviceTokenRepository: PushDeviceTokenRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var fcmGateway: FcmGateway
    private lateinit var service: FcmPushService

    @BeforeEach
    fun setUp() {
        pushDeviceTokenRepository = mock()
        memberRepository = mock()
        fcmGateway = mock()
        service = FcmPushService(pushDeviceTokenRepository, memberRepository, fcmGateway)
    }

    @Test
    fun `does nothing when the member has no registered device tokens`() {
        whenever(pushDeviceTokenRepository.findByMemberName("Kasper")).thenReturn(emptyList())

        service.sendPush("Kasper", "TASK_ASSIGNED", mapOf("title" to "Take out trash"))

        verify(fcmGateway, never()).sendAlert(any(), any(), any(), any())
    }

    @Test
    fun `sends a localized alert to each registered android token`() {
        whenever(pushDeviceTokenRepository.findByMemberName("Kasper")).thenReturn(
            listOf(
                deviceToken("token-1", "Kasper", "android"),
                deviceToken("token-2", "Kasper", "android"),
            ),
        )
        whenever(memberRepository.findAllByName("Kasper")).thenReturn(listOf(member("Kasper", "no")))

        service.sendPush("Kasper", "TASK_ASSIGNED", mapOf("title" to "Ta ut søppel"))

        verify(fcmGateway).sendAlert(
            "token-1",
            "Oppgave tildelt meg",
            "Du har fått tildelt en ny oppgave: Ta ut søppel",
            "/tasks",
        )
        verify(fcmGateway).sendAlert(
            "token-2",
            "Oppgave tildelt meg",
            "Du har fått tildelt en ny oppgave: Ta ut søppel",
            "/tasks",
        )
    }

    @Test
    fun `skips non-android tokens`() {
        whenever(pushDeviceTokenRepository.findByMemberName("Kasper")).thenReturn(
            listOf(deviceToken("ios-token", "Kasper", "ios")),
        )
        whenever(memberRepository.findAllByName("Kasper")).thenReturn(listOf(member("Kasper", "no")))

        service.sendPush("Kasper", "TASK_ASSIGNED", mapOf("title" to "Ta ut søppel"))

        verify(fcmGateway, never()).sendAlert(any(), any(), any(), any())
    }

    @Test
    fun `uses the member's chosen language and routes new messages to chat`() {
        whenever(pushDeviceTokenRepository.findByMemberName("Emma")).thenReturn(
            listOf(deviceToken("token-3", "Emma", "android")),
        )
        whenever(memberRepository.findAllByName("Emma")).thenReturn(listOf(member("Emma", "en")))

        service.sendPush("Emma", "NEW_MESSAGE", mapOf("sender" to "Kasper", "preview" to "hei"))

        verify(fcmGateway).sendAlert("token-3", "New chat message", "Kasper: \"hei\"", "/chat")
    }

    @Test
    fun `falls back to norwegian when the member has no stored language`() {
        whenever(pushDeviceTokenRepository.findByMemberName("Kasper")).thenReturn(
            listOf(deviceToken("token-4", "Kasper", "android")),
        )
        whenever(memberRepository.findAllByName("Kasper")).thenReturn(listOf(member("Kasper", null)))

        service.sendPush("Kasper", "KUDOS_RECEIVED", mapOf("sender" to "Emma", "context" to "Vasket kjøkkenet"))

        verify(fcmGateway).sendAlert(
            "token-4",
            "Skryt jeg får",
            "💛 Emma ga deg kudos: Vasket kjøkkenet",
            "/social",
        )
    }

    private fun deviceToken(
        token: String,
        memberName: String,
        platform: String,
    ) = PushDeviceToken(token = token, memberName = memberName, platform = platform, updatedAt = Instant.now())

    private fun member(
        name: String,
        language: String?,
    ) = Member(name = name, email = "$name@example.com", language = language)
}
