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

class AccountOperationsDisplayNameTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var tokenService: TokenService
    private lateinit var operations: AccountOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        tokenService = mock()
        operations = AccountOperations(memberRepository, tokenService, UserProfileService(memberRepository, mock<FriendshipRepository>()))
    }

    @Test
    fun `renames a member who has not joined a collective and reissues tokens`() {
        val member = member(name = "a1b2c3d4e5", collectiveCode = null)
        whenever(memberRepository.findByName("a1b2c3d4e5")).thenReturn(member)
        whenever(memberRepository.findByName("Kasper")).thenReturn(null)
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(tokenService.issueTokenPair(any<Member>()))
            .thenReturn(TokenResult("new-access", "new-refresh", "Bearer", 3600))

        val result = operations.updateDisplayName("a1b2c3d4e5", "  Kasper  ")

        val saved = argumentCaptor<Member>()
        verify(memberRepository).save(saved.capture())
        assertEquals("Kasper", saved.firstValue.name)
        // The old access token's subject no longer resolves, so a fresh pair is mandatory.
        assertEquals("new-access", result.accessToken)
        assertEquals("Kasper", result.user.name)
    }

    @Test
    fun `refuses to rename a member who already belongs to a collective`() {
        // Tasks, expenses and chat messages all reference the member by name, so a rename here
        // would orphan their history.
        whenever(memberRepository.findByName("Kasper")).thenReturn(member(name = "Kasper", collectiveCode = "ABC123"))

        assertThrows<IllegalArgumentException> { operations.updateDisplayName("Kasper", "Kasper II") }

        verify(memberRepository, never()).save(any<Member>())
    }

    @Test
    fun `refuses a name that is already taken`() {
        whenever(memberRepository.findByName("a1b2c3d4e5")).thenReturn(member(name = "a1b2c3d4e5", collectiveCode = null))
        whenever(memberRepository.findByName("Kasper")).thenReturn(member(name = "Kasper", id = 2, collectiveCode = "ABC123"))

        assertThrows<IllegalArgumentException> { operations.updateDisplayName("a1b2c3d4e5", "Kasper") }

        verify(memberRepository, never()).save(any<Member>())
    }

    @Test
    fun `refuses a blank name`() {
        whenever(memberRepository.findByName("a1b2c3d4e5")).thenReturn(member(name = "a1b2c3d4e5", collectiveCode = null))

        assertThrows<IllegalArgumentException> { operations.updateDisplayName("a1b2c3d4e5", "   ") }

        verify(memberRepository, never()).save(any<Member>())
    }

    @Test
    fun `keeping the same name is allowed and does not trip the uniqueness check`() {
        val member = member(name = "Kasper", collectiveCode = null)
        whenever(memberRepository.findByName("Kasper")).thenReturn(member)
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(tokenService.issueTokenPair(any<Member>()))
            .thenReturn(TokenResult("new-access", "new-refresh", "Bearer", 3600))

        val result = operations.updateDisplayName("Kasper", "Kasper")

        assertEquals("Kasper", result.user.name)
    }

    private fun member(
        name: String,
        id: Long = 1,
        collectiveCode: String?,
    ) = Member(id = id, name = name, email = "$id@example.com", collectiveCode = collectiveCode)
}
