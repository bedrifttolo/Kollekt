package com.kollekt.api

import com.kollekt.api.dto.CreatePartyQuestionRequest
import com.kollekt.api.dto.JoinPartyGameRequest
import com.kollekt.api.dto.PartyGameRoomDto
import com.kollekt.api.dto.PartyReadyRequest
import com.kollekt.service.PartyGameService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.oauth2.jwt.Jwt

class PartyGameControllerTest {
    private lateinit var partyGameService: PartyGameService
    private lateinit var controller: PartyGameController
    private lateinit var jwt: Jwt
    private lateinit var room: PartyGameRoomDto

    @BeforeEach
    fun setUp() {
        partyGameService = mock()
        controller = PartyGameController(partyGameService)
        jwt = Jwt.withTokenValue("token").header("alg", "none").subject("Kasper").build()
        room =
            PartyGameRoomDto(
                code = "ABC234",
                hostName = "Kasper",
                status = "LOBBY",
                currentQuestionIndex = 0,
                participants = emptyList(),
                myQuestions = emptyList(),
                questions = emptyList(),
            )
    }

    @Test
    fun `room endpoints delegate request values and authenticated subject`() {
        whenever(partyGameService.createRoom("Kasper")).thenReturn(room)
        whenever(partyGameService.joinRoom("ABC234", "Kasper")).thenReturn(room)
        whenever(partyGameService.getRoom("ABC234", "Kasper")).thenReturn(room)
        whenever(partyGameService.addQuestion("ABC234", "Kasper", "Prompt", "WILDCARD")).thenReturn(room)
        whenever(partyGameService.deleteQuestion("ABC234", 7, "Kasper")).thenReturn(room)
        whenever(partyGameService.setReady("ABC234", "Kasper", true)).thenReturn(room)
        whenever(partyGameService.start("ABC234", "Kasper")).thenReturn(room)
        whenever(partyGameService.next("ABC234", "Kasper")).thenReturn(room)

        controller.createRoom(jwt)
        controller.joinRoom(JoinPartyGameRequest("ABC234"), jwt)
        controller.getRoom("ABC234", jwt)
        controller.addQuestion("ABC234", CreatePartyQuestionRequest("Prompt", "WILDCARD"), jwt)
        controller.deleteQuestion("ABC234", 7, jwt)
        controller.setReady("ABC234", PartyReadyRequest(true), jwt)
        controller.start("ABC234", jwt)
        controller.next("ABC234", jwt)

        verify(partyGameService).createRoom("Kasper")
        verify(partyGameService).joinRoom("ABC234", "Kasper")
        verify(partyGameService).getRoom("ABC234", "Kasper")
        verify(partyGameService).addQuestion("ABC234", "Kasper", "Prompt", "WILDCARD")
        verify(partyGameService).deleteQuestion("ABC234", 7, "Kasper")
        verify(partyGameService).setReady("ABC234", "Kasper", true)
        verify(partyGameService).start("ABC234", "Kasper")
        verify(partyGameService).next("ABC234", "Kasper")
    }
}
