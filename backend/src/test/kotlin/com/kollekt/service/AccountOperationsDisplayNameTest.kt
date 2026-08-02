package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.repository.FriendshipRepository
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

class AccountOperationsDisplayNameTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var tokenService: TokenService
    private lateinit var currentMemberContext: CurrentMemberContext
    private lateinit var operations: AccountOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        tokenService = mock()
        currentMemberContext = CurrentMemberContext(memberRepository)
        operations =
            AccountOperations(
                memberRepository,
                tokenService,
                UserProfileService(memberRepository, mock<FriendshipRepository>(), currentMemberContext),
                currentMemberContext,
            )
    }

    private fun jwtFor(id: Long) = Jwt.withTokenValue("token").header("alg", "none").subject(id.toString()).claim("uid", id).build()

    @Test
    fun `renames a member who has not joined a collective and reissues tokens`() {
        val member = member(name = "a1b2c3d4e5", collectiveCode = null)
        whenever(memberRepository.findById(1L)).thenReturn(Optional.of(member))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(tokenService.issueTokenPair(any<Member>()))
            .thenReturn(TokenResult("new-access", "new-refresh", "Bearer", 3600))

        val result = operations.updateDisplayName(jwtFor(1), "  Kasper  ")

        val saved = argumentCaptor<Member>()
        verify(memberRepository).save(saved.capture())
        assertEquals("Kasper", saved.firstValue.name)
        assertEquals("new-access", result.accessToken)
        assertEquals("Kasper", result.user.name)
    }

    @Test
    fun `refuses to rename a member who already belongs to a collective`() {
        // Tasks, expenses and chat messages all reference the member by name, so a rename here
        // would orphan their history.
        whenever(memberRepository.findById(1L)).thenReturn(Optional.of(member(name = "Kasper", collectiveCode = "ABC123")))

        assertThrows<IllegalArgumentException> { operations.updateDisplayName(jwtFor(1), "Kasper II") }

        verify(memberRepository, never()).save(any<Member>())
    }

    @Test
    fun `refuses a blank name`() {
        assertThrows<IllegalArgumentException> { operations.updateDisplayName(jwtFor(1), "   ") }

        verify(memberRepository, never()).save(any<Member>())
    }

    @Test
    fun `allows a name that collides with another pre-join member`() {
        // Uniqueness before joining a collective is no longer enforced — two people can share a
        // display name until one of them actually joins a household (see
        // CollectiveOperations.joinCollective).
        whenever(memberRepository.findById(1L)).thenReturn(Optional.of(member(name = "a1b2c3d4e5", collectiveCode = null)))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(tokenService.issueTokenPair(any<Member>()))
            .thenReturn(TokenResult("new-access", "new-refresh", "Bearer", 3600))

        val result = operations.updateDisplayName(jwtFor(1), "Kasper")

        assertEquals("Kasper", result.user.name)
    }

    @Test
    fun `keeping the same name is allowed`() {
        val member = member(name = "Kasper", collectiveCode = null)
        whenever(memberRepository.findById(1L)).thenReturn(Optional.of(member))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(tokenService.issueTokenPair(any<Member>()))
            .thenReturn(TokenResult("new-access", "new-refresh", "Bearer", 3600))

        val result = operations.updateDisplayName(jwtFor(1), "Kasper")

        assertEquals("Kasper", result.user.name)
    }

    private fun member(
        name: String,
        id: Long = 1,
        collectiveCode: String?,
    ) = Member(id = id, name = name, email = "$id@example.com", collectiveCode = collectiveCode)
}
