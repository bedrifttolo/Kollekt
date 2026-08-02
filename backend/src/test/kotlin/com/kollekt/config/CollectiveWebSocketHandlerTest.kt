package com.kollekt.config

import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import com.kollekt.service.RealtimeUpdateService
import com.nimbusds.jose.jwk.source.ImmutableSecret
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import java.net.URI
import java.time.Instant
import javax.crypto.spec.SecretKeySpec

class CollectiveWebSocketHandlerTest {
    private val memberRepository: MemberRepository = mock()
    private val realtimeUpdateService: RealtimeUpdateService = mock()
    private val session: WebSocketSession = mock()
    private val attributes = mutableMapOf<String, Any>()

    private val secret = "test-jwt-secret-that-is-at-least-32-characters-long"
    private val key = SecretKeySpec(secret.toByteArray(), "HmacSHA256")
    private val jwtDecoder: JwtDecoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build()
    private val jwtEncoder: JwtEncoder = NimbusJwtEncoder(ImmutableSecret(key))
    private val handler = TestableCollectiveWebSocketHandler(memberRepository, realtimeUpdateService, jwtDecoder)

    private fun tokenFor(
        subject: String,
        uid: Long? = null,
    ): String {
        val claims =
            JwtClaimsSet
                .builder()
                .subject(subject)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .apply { if (uid != null) claim("uid", uid) }
                .build()
        val header = JwsHeader.with(MacAlgorithm.HS256).build()
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).tokenValue
    }

    private class TestableCollectiveWebSocketHandler(
        memberRepository: MemberRepository,
        realtimeUpdateService: RealtimeUpdateService,
        jwtDecoder: JwtDecoder,
    ) : CollectiveWebSocketHandler(memberRepository, realtimeUpdateService, jwtDecoder) {
        fun receiveText(
            session: WebSocketSession,
            message: TextMessage,
        ) = handleTextMessage(session, message)
    }

    @Test
    fun `afterConnectionEstablished closes when uri is missing`() {
        whenever(session.uri).thenReturn(null)

        handler.afterConnectionEstablished(session)

        verify(session).close(
            argThat { code == CloseStatus.BAD_DATA.code && reason == "Missing URI" },
        )
        verify(realtimeUpdateService, never()).register(any(), any())
    }

    @Test
    fun `afterConnectionEstablished closes when member name is missing`() {
        whenever(session.uri).thenReturn(URI("ws://localhost/ws/collective"))

        handler.afterConnectionEstablished(session)

        verify(session).close(
            argThat { code == CloseStatus.BAD_DATA.code && reason == "Missing memberName" },
        )
    }

    @Test
    fun `afterConnectionEstablished closes when token is missing`() {
        whenever(session.uri).thenReturn(URI("ws://localhost/ws/collective?memberName=Kasper"))

        handler.afterConnectionEstablished(session)

        verify(session).close(
            argThat { code == CloseStatus.POLICY_VIOLATION.code && reason == "Unauthorized" },
        )
        verify(memberRepository, never()).findById(any())
        verify(realtimeUpdateService, never()).register(any(), any())
    }

    @Test
    fun `afterConnectionEstablished closes when token subject does not match member`() {
        whenever(session.uri).thenReturn(
            URI("ws://localhost/ws/collective?memberName=Kasper&token=${tokenFor("Mallory", uid = 99)}"),
        )
        whenever(memberRepository.findById(99)).thenReturn(
            java.util.Optional.of(Member(id = 99, name = "Mallory", email = "mallory@example.com", collectiveCode = "XYZ789")),
        )

        handler.afterConnectionEstablished(session)

        verify(session).close(
            argThat { code == CloseStatus.POLICY_VIOLATION.code && reason == "Unauthorized" },
        )
        verify(realtimeUpdateService, never()).register(any(), any())
    }

    @Test
    fun `afterConnectionEstablished closes when member has no collective`() {
        whenever(session.uri).thenReturn(
            URI("ws://localhost/ws/collective?memberName=Kasper&token=${tokenFor("Kasper", uid = 1)}"),
        )
        whenever(memberRepository.findById(1)).thenReturn(
            java.util.Optional.of(Member(id = 1, name = "Kasper", email = "kasper@example.com", collectiveCode = null)),
        )

        handler.afterConnectionEstablished(session)

        verify(session).close(
            argThat { code == CloseStatus.NOT_ACCEPTABLE.code && reason == "Member has no collective" },
        )
    }

    @Test
    fun `afterConnectionEstablished stores collective and registers session`() {
        whenever(session.uri).thenReturn(
            URI("ws://localhost/ws/collective?memberName=Kasper&token=${tokenFor("Kasper", uid = 1)}"),
        )
        whenever(session.attributes).thenReturn(attributes)
        whenever(memberRepository.findById(1)).thenReturn(
            java.util.Optional.of(Member(id = 1, name = "Kasper", email = "kasper@example.com", collectiveCode = "ABC123")),
        )

        handler.afterConnectionEstablished(session)

        verify(realtimeUpdateService).register("ABC123", session)
        kotlin.test.assertEquals("ABC123", attributes["collectiveCode"])
    }

    @Test
    fun `afterConnectionClosed unregisters stored collective`() {
        whenever(session.attributes).thenReturn(mutableMapOf<String, Any>("collectiveCode" to "ABC123"))

        handler.afterConnectionClosed(session, CloseStatus.NORMAL)

        verify(realtimeUpdateService).unregister("ABC123", session)
    }

    @Test
    fun `handleTextMessage responds to ping`() {
        handler.receiveText(session, TextMessage("ping"))

        verify(session).sendMessage(TextMessage("""{"type":"pong"}"""))
    }
}
