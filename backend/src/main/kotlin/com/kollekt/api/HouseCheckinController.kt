package com.kollekt.api

import com.kollekt.api.dto.CheckinResponseDto
import com.kollekt.api.dto.CheckinSummaryDto
import com.kollekt.api.dto.CreateCheckinResponseRequest
import com.kollekt.api.dto.HouseCheckinDto
import com.kollekt.service.HouseCheckinOperations
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
class HouseCheckinController(
    private val operations: HouseCheckinOperations,
) {
    @PostMapping("/api/collectives/{collectiveId}/checkins/generate")
    fun generate(
        @PathVariable collectiveId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): HouseCheckinDto = operations.generate(collectiveId, jwt.subject)

    @PostMapping("/api/checkins/{checkinId}/responses")
    @ResponseStatus(HttpStatus.CREATED)
    fun respond(
        @PathVariable checkinId: Long,
        @RequestBody request: CreateCheckinResponseRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): CheckinResponseDto = operations.submitResponse(checkinId, request, jwt.subject)

    @GetMapping("/api/checkins/{checkinId}/summary")
    fun summary(
        @PathVariable checkinId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): CheckinSummaryDto = operations.getSummary(checkinId, jwt.subject)
}
