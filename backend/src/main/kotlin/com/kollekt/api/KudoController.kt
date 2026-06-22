package com.kollekt.api

import com.kollekt.api.dto.CreateKudoRequest
import com.kollekt.api.dto.KudoDto
import com.kollekt.api.dto.KudosWeeklySummaryDto
import com.kollekt.service.KudoOperations
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
class KudoController(
    private val operations: KudoOperations,
) {
    @PostMapping("/api/kudos")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @RequestBody request: CreateKudoRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): KudoDto = operations.create(request, jwt.subject)

    @GetMapping("/api/kudos/feed")
    fun feed(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<KudoDto> = operations.getFeed(jwt.subject)

    @GetMapping("/api/kudos/weekly-summary")
    fun weeklySummary(
        @AuthenticationPrincipal jwt: Jwt,
    ): KudosWeeklySummaryDto = operations.getWeeklySummary(jwt.subject)
}
