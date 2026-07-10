package com.kollekt.repository

import com.kollekt.domain.Friendship
import org.springframework.data.jpa.repository.JpaRepository

interface FriendshipRepository : JpaRepository<Friendship, Long> {
    fun findAllByMemberId(memberId: Long): List<Friendship>

    fun findAllByMemberIdIn(memberIds: Collection<Long>): List<Friendship>

    fun existsByMemberIdAndFriendId(
        memberId: Long,
        friendId: Long,
    ): Boolean

    fun deleteByMemberIdAndFriendId(
        memberId: Long,
        friendId: Long,
    ): Long
}
