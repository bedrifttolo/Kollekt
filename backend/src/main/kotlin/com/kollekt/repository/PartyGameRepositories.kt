package com.kollekt.repository

import com.kollekt.domain.PartyGameParticipant
import com.kollekt.domain.PartyGameQuestion
import com.kollekt.domain.PartyGameRoom
import org.springframework.data.jpa.repository.JpaRepository

interface PartyGameRoomRepository : JpaRepository<PartyGameRoom, String>

interface PartyGameParticipantRepository : JpaRepository<PartyGameParticipant, Long> {
    fun findAllByRoomCodeOrderByJoinedAt(roomCode: String): List<PartyGameParticipant>

    fun findByRoomCodeAndMemberName(
        roomCode: String,
        memberName: String,
    ): PartyGameParticipant?
}

interface PartyGameQuestionRepository : JpaRepository<PartyGameQuestion, Long> {
    fun findAllByRoomCode(roomCode: String): List<PartyGameQuestion>

    fun findByIdAndRoomCode(
        id: Long,
        roomCode: String,
    ): PartyGameQuestion?
}
