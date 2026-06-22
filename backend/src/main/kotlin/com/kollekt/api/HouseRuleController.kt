package com.kollekt.api

import com.kollekt.api.dto.HouseRulesDto
import com.kollekt.api.dto.UpdateHouseRulesRequest
import com.kollekt.service.HouseRuleOperations
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class HouseRuleController(
    private val operations: HouseRuleOperations,
) {
    @GetMapping("/api/collectives/{collectiveId}/rules")
    fun getRules(
        @PathVariable collectiveId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): HouseRulesDto = operations.getLatest(collectiveId, jwt.subject)

    @PutMapping("/api/collectives/{collectiveId}/rules")
    fun updateRules(
        @PathVariable collectiveId: Long,
        @RequestBody request: UpdateHouseRulesRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): HouseRulesDto = operations.update(collectiveId, request.content, jwt.subject)

    @PostMapping("/api/collectives/{collectiveId}/rules/{version}/ack")
    fun acknowledge(
        @PathVariable collectiveId: Long,
        @PathVariable version: Int,
        @AuthenticationPrincipal jwt: Jwt,
    ): HouseRulesDto = operations.acknowledge(collectiveId, version, jwt.subject)
}
