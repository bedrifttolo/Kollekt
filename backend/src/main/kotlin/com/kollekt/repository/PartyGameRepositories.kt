package com.kollekt.repository

import com.kollekt.domain.PartyGameParticipant
import com.kollekt.domain.PartyGameQuestion
import com.kollekt.domain.PartyGameRoom
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

// Game rooms are cross-household by design (joined via a shareable room_code, not scoped to a
// collective), so these renames intentionally match on bare name — consistent with how the rest
// of the party-game domain already treats identity.
interface PartyGameRoomRepository : JpaRepository<PartyGameRoom, String> {
    @Modifying
    @Query("update PartyGameRoom r set r.hostName = :newName where r.hostName = :oldName")
    fun renameHostName(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
    ): Int
}

interface PartyGameParticipantRepository : JpaRepository<PartyGameParticipant, Long> {
    fun findAllByRoomCodeOrderByJoinedAt(roomCode: String): List<PartyGameParticipant>

    fun findByRoomCodeAndMemberName(
        roomCode: String,
        memberName: String,
    ): PartyGameParticipant?

    @Modifying
    @Query("update PartyGameParticipant p set p.memberName = :newName where p.memberName = :oldName")
    fun renameMemberName(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
    ): Int
}

interface PartyGameQuestionRepository : JpaRepository<PartyGameQuestion, Long> {
    fun findAllByRoomCode(roomCode: String): List<PartyGameQuestion>

    fun findByIdAndRoomCode(
        id: Long,
        roomCode: String,
    ): PartyGameQuestion?

    @Modifying
    @Query("update PartyGameQuestion q set q.authorName = :newName where q.authorName = :oldName")
    fun renameAuthorName(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
    ): Int
}
