package com.kollekt.api.dto

data class JoinPartyGameRequest(val roomCode: String)

data class CreatePartyQuestionRequest(
    val prompt: String,
    val category: String,
)

data class PartyReadyRequest(val ready: Boolean)

data class PartyParticipantDto(
    val name: String,
    val ready: Boolean,
    val questionCount: Int,
)

data class PartyQuestionDto(
    val id: Long,
    val prompt: String,
    val category: String,
)

data class PartyGameRoomDto(
    val code: String,
    val hostName: String,
    val status: String,
    val currentQuestionIndex: Int,
    val participants: List<PartyParticipantDto>,
    val myQuestions: List<PartyQuestionDto>,
    val questions: List<PartyQuestionDto>,
)
