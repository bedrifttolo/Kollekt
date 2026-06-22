package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.domain.PartyGameParticipant
import com.kollekt.domain.PartyGameQuestion
import com.kollekt.domain.PartyGameRoom
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PartyGameParticipantRepository
import com.kollekt.repository.PartyGameQuestionRepository
import com.kollekt.repository.PartyGameRoomRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional

class PartyGameServiceTest {
    private lateinit var roomRepository: PartyGameRoomRepository
    private lateinit var participantRepository: PartyGameParticipantRepository
    private lateinit var questionRepository: PartyGameQuestionRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var service: PartyGameService

    @BeforeEach
    fun setUp() {
        roomRepository = mock()
        participantRepository = mock()
        questionRepository = mock()
        memberRepository = mock()
        service = PartyGameService(roomRepository, participantRepository, questionRepository, memberRepository)
    }

    @Test
    fun `create room adds creator as participant`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper"))
        whenever(roomRepository.existsById(any())).thenReturn(false)
        whenever(roomRepository.save(any<PartyGameRoom>())).thenAnswer { it.arguments[0] as PartyGameRoom }
        whenever(roomRepository.findById(any())).thenAnswer {
            Optional.of(PartyGameRoom(code = it.arguments[0] as String, hostName = "Kasper"))
        }
        whenever(participantRepository.save(any<PartyGameParticipant>())).thenAnswer { it.arguments[0] as PartyGameParticipant }
        whenever(participantRepository.findByRoomCodeAndMemberName(any(), any())).thenAnswer {
            PartyGameParticipant(roomCode = it.arguments[0] as String, memberName = it.arguments[1] as String)
        }
        whenever(participantRepository.findAllByRoomCodeOrderByJoinedAt(any())).thenAnswer {
            listOf(PartyGameParticipant(roomCode = it.arguments[0] as String, memberName = "Kasper"))
        }
        whenever(questionRepository.findAllByRoomCode(any())).thenReturn(emptyList())

        val result = service.createRoom("Kasper")

        assertEquals(6, result.code.length)
        assertEquals("Kasper", result.hostName)
        verify(participantRepository).save(
            org.mockito.kotlin.check { assertEquals("Kasper", it.memberName) },
        )
    }

    @Test
    fun `lobby state hides other players question text`() {
        val room = PartyGameRoom(code = "ABC234", hostName = "Kasper")
        whenever(roomRepository.findById("ABC234")).thenReturn(Optional.of(room))
        whenever(participantRepository.findByRoomCodeAndMemberName("ABC234", "Kasper"))
            .thenReturn(PartyGameParticipant(roomCode = "ABC234", memberName = "Kasper"))
        whenever(participantRepository.findAllByRoomCodeOrderByJoinedAt("ABC234"))
            .thenReturn(
                listOf(
                    PartyGameParticipant(roomCode = "ABC234", memberName = "Kasper"),
                    PartyGameParticipant(roomCode = "ABC234", memberName = "Emma"),
                ),
            )
        whenever(questionRepository.findAllByRoomCode("ABC234"))
            .thenReturn(
                listOf(
                    question(1, "Kasper", "My prompt"),
                    question(2, "Emma", "Hidden prompt"),
                ),
            )

        val result = service.getRoom("ABC234", "Kasper")

        assertEquals(listOf("My prompt"), result.myQuestions.map { it.prompt })
        assertTrue(result.questions.isEmpty())
        assertEquals(1, result.participants.single { it.name == "Emma" }.questionCount)
    }

    @Test
    fun `participant cannot mark ready without a question`() {
        val room = PartyGameRoom(code = "ABC234", hostName = "Kasper")
        whenever(roomRepository.findById("ABC234")).thenReturn(Optional.of(room))
        whenever(participantRepository.findByRoomCodeAndMemberName("ABC234", "Emma"))
            .thenReturn(PartyGameParticipant(roomCode = "ABC234", memberName = "Emma"))
        whenever(questionRepository.findAllByRoomCode("ABC234")).thenReturn(emptyList())

        val error = assertThrows<IllegalArgumentException> { service.setReady("ABC234", "Emma", true) }

        assertEquals("Add at least one question first", error.message)
    }

    @Test
    fun `host starts a ready room and persists a complete shuffled order`() {
        val lobby = PartyGameRoom(code = "ABC234", hostName = "Kasper")
        val playing = lobby.copy(status = "PLAYING")
        val participants =
            listOf(
                PartyGameParticipant(roomCode = "ABC234", memberName = "Kasper", ready = true),
                PartyGameParticipant(roomCode = "ABC234", memberName = "Emma", ready = true),
            )
        val questions = listOf(question(1, "Kasper", "One"), question(2, "Emma", "Two"))
        whenever(roomRepository.findById("ABC234")).thenReturn(Optional.of(lobby), Optional.of(playing))
        whenever(roomRepository.save(any<PartyGameRoom>())).thenAnswer { it.arguments[0] as PartyGameRoom }
        whenever(participantRepository.findByRoomCodeAndMemberName("ABC234", "Kasper"))
            .thenReturn(participants.first())
        whenever(participantRepository.findAllByRoomCodeOrderByJoinedAt("ABC234")).thenReturn(participants)
        whenever(questionRepository.findAllByRoomCode("ABC234")).thenReturn(questions)
        whenever(questionRepository.save(any<PartyGameQuestion>())).thenAnswer { it.arguments[0] as PartyGameQuestion }

        val result = service.start("ABC234", "Kasper")

        val saved = argumentCaptor<PartyGameQuestion>()
        verify(questionRepository, org.mockito.kotlin.times(2)).save(saved.capture())
        assertEquals(setOf(0, 1), saved.allValues.mapNotNull { it.playOrder }.toSet())
        assertEquals("PLAYING", result.status)
        assertEquals(2, result.questions.size)
    }

    private fun member(name: String) =
        Member(
            id = 1,
            name = name,
            email = "${name.lowercase()}@example.com",
        )

    private fun question(
        id: Long,
        author: String,
        prompt: String,
    ) = PartyGameQuestion(
        id = id,
        roomCode = "ABC234",
        authorName = author,
        category = "WILDCARD",
        prompt = prompt,
    )
}
