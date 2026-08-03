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

class ApnsPushServiceTest {
    private lateinit var pushDeviceTokenRepository: PushDeviceTokenRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var apnsGateway: ApnsGateway
    private lateinit var service: ApnsPushService

    @BeforeEach
    fun setUp() {
        pushDeviceTokenRepository = mock()
        memberRepository = mock()
        apnsGateway = mock()
        service = ApnsPushService(pushDeviceTokenRepository, memberRepository, apnsGateway)
    }

    @Test
    fun `does nothing when the member has no registered device tokens`() {
        whenever(pushDeviceTokenRepository.findByMemberName("Kasper")).thenReturn(emptyList())

        service.sendPush("Kasper", "TASK_ASSIGNED", mapOf("title" to "Take out trash"))

        verify(apnsGateway, never()).sendAlert(any(), any(), any(), any())
    }

    @Test
    fun `sends a localized alert to each registered ios token`() {
        whenever(pushDeviceTokenRepository.findByMemberName("Kasper")).thenReturn(
            listOf(
                deviceToken("token-1", "Kasper", "ios"),
                deviceToken("token-2", "Kasper", "ios"),
            ),
        )
        whenever(memberRepository.findAllByName("Kasper")).thenReturn(listOf(member("Kasper", "no")))

        service.sendPush("Kasper", "TASK_ASSIGNED", mapOf("title" to "Ta ut søppel"))

        verify(apnsGateway).sendAlert(
            "token-1",
            "Oppgave tildelt meg",
            "Du har fått tildelt en ny oppgave: Ta ut søppel",
            "/tasks",
        )
        verify(apnsGateway).sendAlert(
            "token-2",
            "Oppgave tildelt meg",
            "Du har fått tildelt en ny oppgave: Ta ut søppel",
            "/tasks",
        )
    }

    @Test
    fun `skips non-ios tokens`() {
        whenever(pushDeviceTokenRepository.findByMemberName("Kasper")).thenReturn(
            listOf(deviceToken("android-token", "Kasper", "android")),
        )
        whenever(memberRepository.findAllByName("Kasper")).thenReturn(listOf(member("Kasper", "no")))

        service.sendPush("Kasper", "TASK_ASSIGNED", mapOf("title" to "Ta ut søppel"))

        verify(apnsGateway, never()).sendAlert(any(), any(), any(), any())
    }

    @Test
    fun `uses the member's chosen language and routes new messages to chat`() {
        whenever(pushDeviceTokenRepository.findByMemberName("Emma")).thenReturn(
            listOf(deviceToken("token-3", "Emma", "ios")),
        )
        whenever(memberRepository.findAllByName("Emma")).thenReturn(listOf(member("Emma", "en")))

        service.sendPush("Emma", "NEW_MESSAGE", mapOf("sender" to "Kasper", "preview" to "hei"))

        verify(apnsGateway).sendAlert("token-3", "New chat message", "Kasper: \"hei\"", "/chat")
    }

    @Test
    fun `falls back to norwegian when the member has no stored language`() {
        whenever(pushDeviceTokenRepository.findByMemberName("Kasper")).thenReturn(
            listOf(deviceToken("token-4", "Kasper", "ios")),
        )
        whenever(memberRepository.findAllByName("Kasper")).thenReturn(listOf(member("Kasper", null)))

        service.sendPush("Kasper", "KUDOS_RECEIVED", mapOf("sender" to "Emma", "context" to "Vasket kjøkkenet"))

        verify(apnsGateway).sendAlert(
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
