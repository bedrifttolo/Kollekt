package com.kollekt.service

import com.kollekt.api.dto.PartyGameRoomDto
import com.kollekt.api.dto.PartyParticipantDto
import com.kollekt.api.dto.PartyQuestionDto
import com.kollekt.domain.PartyGameParticipant
import com.kollekt.domain.PartyGameQuestion
import com.kollekt.domain.PartyGameRoom
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PartyGameParticipantRepository
import com.kollekt.repository.PartyGameQuestionRepository
import com.kollekt.repository.PartyGameRoomRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom

@Service
class PartyGameService(
    private val roomRepository: PartyGameRoomRepository,
    private val participantRepository: PartyGameParticipantRepository,
    private val questionRepository: PartyGameQuestionRepository,
    private val memberRepository: MemberRepository,
) {
    private val random = SecureRandom()
    private val codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    private val allowedCategories =
        setOf(
            "HOT_TAKES",
            "PLOT_TWISTS",
            "TINY_CONFESSIONS",
            "FUTURE_HEADLINES",
            "HOUSE_AWARDS",
            "IMPOSSIBLE_CHOICES",
            "FRIENDLY_CHALLENGES",
            "WILDCARD",
            "PEKELEK",
            "JEG_HAR_ALDRI",
            "RED_FLAG_DEALBREAKER_OK",
            "FUCK_MARRY_KILL",
            "LAG_EN_REGEL",
            "DILEMMA",
            "KATEGORILEK",
        )

    @Transactional
    fun createRoom(actorName: String): PartyGameRoomDto {
        requireMember(actorName)
        val room = roomRepository.save(PartyGameRoom(code = uniqueCode(), hostName = actorName))
        participantRepository.save(PartyGameParticipant(roomCode = room.code, memberName = actorName))
        return getRoom(room.code, actorName)
    }

    @Transactional
    fun joinRoom(
        rawCode: String,
        actorName: String,
    ): PartyGameRoomDto {
        requireMember(actorName)
        val room = requireRoom(rawCode)
        require(room.status == "LOBBY") { "This room has already started" }
        if (participantRepository.findByRoomCodeAndMemberName(room.code, actorName) == null) {
            participantRepository.save(PartyGameParticipant(roomCode = room.code, memberName = actorName))
        }
        return getRoom(room.code, actorName)
    }

    @Transactional(readOnly = true)
    fun getRoom(
        rawCode: String,
        actorName: String,
    ): PartyGameRoomDto {
        val room = requireRoom(rawCode)
        requireParticipant(room.code, actorName)
        return room.toDto(actorName)
    }

    @Transactional
    fun addQuestion(
        rawCode: String,
        actorName: String,
        rawPrompt: String,
        rawCategory: String,
    ): PartyGameRoomDto {
        val room = requireRoom(rawCode)
        val participant = requireParticipant(room.code, actorName)
        require(room.status == "LOBBY") { "Questions can only be added before the game starts" }
        require(!participant.ready) { "Mark yourself as writing before adding another question" }
        val prompt = rawPrompt.trim()
        val category = rawCategory.trim().uppercase()
        require(prompt.isNotBlank() && prompt.length <= 300) { "Question must be between 1 and 300 characters" }
        require(category in allowedCategories) { "Unsupported category" }
        questionRepository.save(PartyGameQuestion(roomCode = room.code, authorName = actorName, prompt = prompt, category = category))
        return getRoom(room.code, actorName)
    }

    @Transactional
    fun deleteQuestion(
        rawCode: String,
        questionId: Long,
        actorName: String,
    ): PartyGameRoomDto {
        val room = requireRoom(rawCode)
        require(room.status == "LOBBY") { "Questions can only be removed before the game starts" }
        val question = questionRepository.findByIdAndRoomCode(questionId, room.code) ?: throw IllegalArgumentException("Question not found")
        require(question.authorName == actorName) { "You can only remove your own question" }
        questionRepository.delete(question)
        return getRoom(room.code, actorName)
    }

    @Transactional
    fun setReady(
        rawCode: String,
        actorName: String,
        ready: Boolean,
    ): PartyGameRoomDto {
        val room = requireRoom(rawCode)
        require(room.status == "LOBBY") { "This room has already started" }
        val participant = requireParticipant(room.code, actorName)
        if (ready) {
            require(
                questionRepository.findAllByRoomCode(room.code).any { it.authorName == actorName },
            ) { "Add at least one question first" }
        }
        participantRepository.save(participant.copy(ready = ready))
        return getRoom(room.code, actorName)
    }

    @Transactional
    fun start(
        rawCode: String,
        actorName: String,
    ): PartyGameRoomDto {
        val room = requireRoom(rawCode)
        require(room.hostName == actorName) { "Only the room creator can start" }
        require(room.status == "LOBBY") { "This room has already started" }
        val participants = participantRepository.findAllByRoomCodeOrderByJoinedAt(room.code)
        require(participants.size >= 2) { "At least two players must join" }
        require(participants.all { it.ready }) { "Everyone must be done writing" }
        val questions = questionRepository.findAllByRoomCode(room.code)
        require(questions.isNotEmpty()) { "Add at least one question" }
        questions.shuffled().forEachIndexed { index, question ->
            questionRepository.save(question.copy(playOrder = index))
        }
        roomRepository.save(room.copy(status = "PLAYING", currentQuestionIndex = 0))
        return getRoom(room.code, actorName)
    }

    @Transactional
    fun next(
        rawCode: String,
        actorName: String,
    ): PartyGameRoomDto {
        val room = requireRoom(rawCode)
        require(room.hostName == actorName) { "Only the room creator can advance" }
        require(room.status == "PLAYING") { "The game is not running" }
        val count = questionRepository.findAllByRoomCode(room.code).size
        val nextIndex = room.currentQuestionIndex + 1
        roomRepository.save(
            if (nextIndex >= count) {
                room.copy(status = "FINISHED", currentQuestionIndex = count)
            } else {
                room.copy(currentQuestionIndex = nextIndex)
            },
        )
        return getRoom(room.code, actorName)
    }

    private fun requireMember(name: String) {
        require(memberRepository.findByName(name) != null) { "User not found" }
    }

    private fun requireRoom(rawCode: String): PartyGameRoom =
        roomRepository.findById(rawCode.trim().uppercase()).orElseThrow { IllegalArgumentException("Room not found") }

    private fun requireParticipant(
        roomCode: String,
        actorName: String,
    ): PartyGameParticipant =
        participantRepository.findByRoomCodeAndMemberName(roomCode, actorName)
            ?: throw IllegalArgumentException("Join the room first")

    private fun uniqueCode(): String {
        repeat(20) {
            val code = buildString(6) { repeat(6) { append(codeAlphabet[random.nextInt(codeAlphabet.length)]) } }
            if (!roomRepository.existsById(code)) return code
        }
        throw IllegalStateException("Could not create a unique room code")
    }

    private fun PartyGameRoom.toDto(actorName: String): PartyGameRoomDto {
        val participants = participantRepository.findAllByRoomCodeOrderByJoinedAt(code)
        val questions = questionRepository.findAllByRoomCode(code)
        val counts = questions.groupingBy { it.authorName }.eachCount()
        val orderedQuestions =
            if (status == "PLAYING" || status == "FINISHED") {
                questions.sortedBy { it.playOrder }
            } else {
                emptyList()
            }
        return PartyGameRoomDto(
            code = code,
            hostName = hostName,
            status = status,
            currentQuestionIndex = currentQuestionIndex,
            participants = participants.map { PartyParticipantDto(it.memberName, it.ready, counts[it.memberName] ?: 0) },
            myQuestions =
                if (status == "LOBBY") {
                    questions.filter { it.authorName == actorName }.map { it.toDto() }
                } else {
                    emptyList()
                },
            questions = orderedQuestions.map { it.toDto() },
        )
    }

    private fun PartyGameQuestion.toDto() = PartyQuestionDto(id, prompt, category)
}
