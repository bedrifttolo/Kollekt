package com.kollekt.service

import com.kollekt.api.dto.FriendDto
import com.kollekt.api.dto.UserDto
import com.kollekt.domain.Friendship
import com.kollekt.domain.Member
import com.kollekt.repository.FriendshipRepository
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserProfileService(
    private val memberRepository: MemberRepository,
    private val friendshipRepository: FriendshipRepository,
    private val currentMemberContext: CurrentMemberContext,
) {
    @Transactional
    fun addFriend(
        memberName: String,
        friendName: String,
    ) {
        if (memberName == friendName) {
            throw IllegalArgumentException("Cannot add yourself as a friend")
        }

        val member = requireSelf(memberName)
        val friend = requireMember(friendName)

        if (friendshipRepository.existsByMemberIdAndFriendId(member.id, friend.id)) {
            throw IllegalArgumentException("'$friendName' is already a friend")
        }
        friendshipRepository.save(Friendship(memberId = member.id, friendId = friend.id))
    }

    @Transactional
    fun removeFriend(
        memberName: String,
        friendName: String,
    ) {
        val member = requireSelf(memberName)
        val friend = requireMember(friendName)
        if (friendshipRepository.deleteByMemberIdAndFriendId(member.id, friend.id) == 0L) {
            throw IllegalArgumentException("'$friendName' is not a friend")
        }
    }

    fun toUserDto(member: Member): UserDto {
        val friendIds = friendshipRepository.findAllByMemberId(member.id).map { it.friendId }
        val friends =
            memberRepository
                .findAllById(friendIds)
                .sortedBy { it.name }
                .map { FriendDto(it.name) }
        return UserDto(
            id = member.id,
            name = member.name,
            email = member.email,
            collectiveCode = member.collectiveCode,
            status = member.status,
            awayUntil = member.awayUntil,
            color = member.color,
            friends = friends,
        )
    }

    fun toUserDtos(members: List<Member>): List<UserDto> {
        if (members.isEmpty()) return emptyList()
        val friendshipsByMember =
            friendshipRepository
                .findAllByMemberIdIn(members.map { it.id })
                .groupBy { it.memberId }
        val friendIds = friendshipsByMember.values.flatten().map { it.friendId }.distinct()
        val friendNamesById = memberRepository.findAllById(friendIds).associate { it.id to it.name }

        return members.map { member ->
            val friends =
                friendshipsByMember[member.id]
                    .orEmpty()
                    .mapNotNull { friendNamesById[it.friendId] }
                    .sorted()
                    .map(::FriendDto)
            UserDto(
                id = member.id,
                name = member.name,
                email = member.email,
                collectiveCode = member.collectiveCode,
                status = member.status,
                awayUntil = member.awayUntil,
                color = member.color,
                friends = friends,
            )
        }
    }

    private fun requireSelf(memberName: String) = currentMemberContext.current(memberName)

    /** Resolves *another* member by bare name — intentionally global/collective-unaware.
     *  Friends can come from any household, so there's no collectiveCode to scope this by.
     *  Never use this to resolve the caller's own identity; use [requireSelf] for that. */
    private fun requireMember(memberName: String): Member =
        memberRepository.findByName(memberName)
            ?: throw IllegalArgumentException("User '$memberName' not found")
}
