package com.kollekt.api

import com.kollekt.api.dto.CollectiveDetailsDto
import com.kollekt.api.dto.UpdateCollectiveDetailsRequest
import com.kollekt.service.CollectiveOperations
import com.kollekt.service.CurrentMemberContext
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class CollectiveController(
    private val collectiveOperations: CollectiveOperations,
    private val currentMemberContext: CurrentMemberContext,
) {
    @GetMapping("/api/collectives/{collectiveId}")
    fun getDetails(
        @PathVariable collectiveId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): CollectiveDetailsDto = collectiveOperations.getCollectiveDetails(collectiveId, currentMemberContext.current(jwt).name)

    @PatchMapping("/api/collectives/{collectiveId}")
    fun updateDetails(
        @PathVariable collectiveId: Long,
        @RequestBody request: UpdateCollectiveDetailsRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): CollectiveDetailsDto = collectiveOperations.updateCollectiveDetails(collectiveId, request, currentMemberContext.current(jwt).name)
}
