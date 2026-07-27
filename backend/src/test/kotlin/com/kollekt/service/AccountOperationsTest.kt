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

class AccountOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var friendshipRepository: FriendshipRepository
    private lateinit var tokenService: TokenService
    private lateinit var userProfileService: UserProfileService
    private lateinit var operations: AccountOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        friendshipRepository = mock()
        tokenService = mock()
        userProfileService = UserProfileService(memberRepository, friendshipRepository)
        operations = AccountOperations(memberRepository, tokenService, userProfileService)
    }

    @Test
    fun `refresh token reissues token pair for rotated subject`() {
        val existing = member(name = "Kasper", email = "kasper@example.com")
        whenever(tokenService.rotateRefreshToken("refresh-token")).thenReturn(RefreshResult("Kasper"))
        whenever(memberRepository.findByName("Kasper")).thenReturn(existing)
        whenever(tokenService.issueTokenPair(existing)).thenReturn(
            TokenResult("new-access", "new-refresh", "Bearer", 3600),
        )

        val result = operations.refreshToken(RefreshTokenRequest("refresh-token"))

        assertEquals("new-access", result.accessToken)
        assertEquals("new-refresh", result.refreshToken)
    }

    @Test
    fun `get user by name uses user profile mapping with defaults`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))

        val result = operations.getUserByName("Kasper")

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
