package com.kollekt.api

import com.kollekt.api.dto.CreatePartyQuestionRequest
import com.kollekt.api.dto.JoinPartyGameRequest
import com.kollekt.api.dto.PartyGameRoomDto
import com.kollekt.api.dto.PartyReadyRequest
import com.kollekt.service.PartyGameService
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/party-game")
class PartyGameController(
    private val partyGameService: PartyGameService,
) {
    @PostMapping("/rooms")
    @ResponseStatus(HttpStatus.CREATED)
    fun createRoom(
        @AuthenticationPrincipal jwt: Jwt,
    ): PartyGameRoomDto = partyGameService.createRoom(jwt.subject)

    @PostMapping("/rooms/join")
    fun joinRoom(
        @RequestBody request: JoinPartyGameRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): PartyGameRoomDto = partyGameService.joinRoom(request.roomCode, jwt.subject)

    @GetMapping("/rooms/{code}")
    fun getRoom(
        @PathVariable code: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): PartyGameRoomDto = partyGameService.getRoom(code, jwt.subject)

    @PostMapping("/rooms/{code}/questions")
    fun addQuestion(
        @PathVariable code: String,
        @RequestBody request: CreatePartyQuestionRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): PartyGameRoomDto = partyGameService.addQuestion(code, jwt.subject, request.prompt, request.category)

    @DeleteMapping("/rooms/{code}/questions/{questionId}")
    fun deleteQuestion(
        @PathVariable code: String,
        @PathVariable questionId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): PartyGameRoomDto = partyGameService.deleteQuestion(code, questionId, jwt.subject)

    @PatchMapping("/rooms/{code}/ready")
    fun setReady(
        @PathVariable code: String,
        @RequestBody request: PartyReadyRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): PartyGameRoomDto = partyGameService.setReady(code, jwt.subject, request.ready)

    @PostMapping("/rooms/{code}/start")
    fun start(
        @PathVariable code: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): PartyGameRoomDto = partyGameService.start(code, jwt.subject)

    @PostMapping("/rooms/{code}/next")
    fun next(
        @PathVariable code: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): PartyGameRoomDto = partyGameService.next(code, jwt.subject)
}
