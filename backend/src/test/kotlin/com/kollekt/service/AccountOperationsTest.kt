package com.kollekt.service

import com.kollekt.api.dto.RefreshTokenRequest
import com.kollekt.domain.Member
import com.kollekt.repository.FriendshipRepository
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

class AccountOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var friendshipRepository: FriendshipRepository
    private lateinit var tokenService: TokenService
    private lateinit var currentMemberContext: CurrentMemberContext
    private lateinit var userProfileService: UserProfileService
    private lateinit var operations: AccountOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        friendshipRepository = mock()
        tokenService = mock()
        currentMemberContext = CurrentMemberContext(memberRepository)
        userProfileService = UserProfileService(memberRepository, friendshipRepository, currentMemberContext)
        operations = AccountOperations(memberRepository, tokenService, userProfileService, currentMemberContext)
    }

    private fun jwtFor(id: Long) = Jwt.withTokenValue("token").header("alg", "none").subject(id.toString()).claim("uid", id).build()

    @Test
    fun `refresh token reissues token pair for rotated subject`() {
        val existing = member(name = "Kasper", email = "kasper@example.com")
        whenever(tokenService.rotateRefreshToken("refresh-token")).thenReturn(RefreshResult("1"))
        whenever(memberRepository.findById(1L)).thenReturn(Optional.of(existing))
        whenever(tokenService.issueTokenPair(existing)).thenReturn(
            TokenResult("new-access", "new-refresh", "Bearer", 3600),
        )

        val result = operations.refreshToken(RefreshTokenRequest("refresh-token"))

        assertEquals("new-access", result.accessToken)
        assertEquals("new-refresh", result.refreshToken)
    }

    @Test
    fun `get current user uses user profile mapping with defaults`() {
        whenever(memberRepository.findById(1L)).thenReturn(Optional.of(member("Kasper", "kasper@example.com")))

        val result = operations.getCurrentUser(jwtFor(1))

        assertEquals("kasper@example.com", result.email)
        assertTrue(result.friends.isEmpty())
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String? = "ABC123",
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )
}
