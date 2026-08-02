package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

class CurrentMemberContextTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var context: CurrentMemberContext

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        context = CurrentMemberContext(memberRepository)
        whenever(memberRepository.findById(1L)).thenReturn(Optional.of(member(1, "Kasper")))
    }

    private fun jwtWithUid(uid: Long) =
        Jwt
            .withTokenValue("token")
            .header("alg", "none")
            .subject(uid.toString())
            .claim("uid", uid)
            .build()

    private fun member(
        id: Long,
        name: String,
    ) = Member(id = id, name = name, email = "$name@example.com", collectiveCode = "ABC123")

    @Test
    fun `requireTokenSubject accepts matching subject`() {
        assertDoesNotThrow {
            context.requireTokenSubject(jwtWithUid(1), "Kasper")
        }
    }

    @Test
    fun `requireTokenSubject rejects mismatched subject`() {
        assertThrows<AccessDeniedException> {
            context.requireTokenSubject(jwtWithUid(1), "Emma")
        }
    }
}
