package com.kollekt.service

import com.kollekt.domain.Friendship
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

class UserProfileServiceTest {
    private val memberRepository = mock<MemberRepository>()
    private val friendshipRepository = mock<FriendshipRepository>()
    private lateinit var service: UserProfileService

    @BeforeEach
    fun setUp() {
        service = UserProfileService(memberRepository, friendshipRepository)
    }

    @Test
    fun `add friend persists a directional relationship`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member(1, "Kasper"))
        whenever(memberRepository.findByName("Emma")).thenReturn(member(2, "Emma"))
        whenever(friendshipRepository.existsByMemberIdAndFriendId(1, 2)).thenReturn(false)

        service.addFriend("Kasper", "Emma")

        val friendship = argumentCaptor<Friendship>()
        verify(friendshipRepository).save(friendship.capture())
        assertEquals(1, friendship.firstValue.memberId)
        assertEquals(2, friendship.firstValue.friendId)
        verify(friendshipRepository, never()).save(Friendship(memberId = 2, friendId = 1))
    }

    @Test
    fun `add friend rejects duplicates`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member(1, "Kasper"))
        whenever(memberRepository.findByName("Emma")).thenReturn(member(2, "Emma"))
        whenever(friendshipRepository.existsByMemberIdAndFriendId(1, 2)).thenReturn(true)

        assertThrows<IllegalArgumentException> { service.addFriend("Kasper", "Emma") }

        verify(friendshipRepository, never()).save(any<Friendship>())
    }

    @Test
    fun `user mapping loads persisted friend names`() {
        val kasper = member(1, "Kasper")
        whenever(friendshipRepository.findAllByMemberId(1)).thenReturn(listOf(Friendship(4, 1, 2)))
        whenever(memberRepository.findAllById(listOf(2))).thenReturn(listOf(member(2, "Emma")))

        val result = service.toUserDto(kasper)

        assertEquals(listOf("Emma"), result.friends.map { it.name })
    }

    private fun member(
        id: Long,
        name: String,
    ) = Member(id = id, name = name, email = "$name@example.com")
}
