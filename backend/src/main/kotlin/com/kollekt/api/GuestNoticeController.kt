package com.kollekt.api

import com.kollekt.api.dto.CreateGuestNoticeRequest
import com.kollekt.api.dto.GuestNoticeDto
import com.kollekt.api.dto.QuietHoursDto
import com.kollekt.api.dto.UpdateQuietHoursRequest
import com.kollekt.service.GuestNoticeOperations
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
class GuestNoticeController(
    private val operations: GuestNoticeOperations,
) {
    @PostMapping("/api/guest-notices")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @RequestBody request: CreateGuestNoticeRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): GuestNoticeDto = operations.create(request, jwt.subject)

    @GetMapping("/api/guest-notices")
    fun getAll(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<GuestNoticeDto> = operations.getAll(jwt.subject)

    @GetMapping("/api/collectives/{collectiveId}/quiet-hours")
    fun getQuietHours(
        @PathVariable collectiveId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): QuietHoursDto = operations.getQuietHours(collectiveId, jwt.subject)

    @PatchMapping("/api/collectives/{collectiveId}/quiet-hours")
    fun updateQuietHours(
        @PathVariable collectiveId: Long,
        @RequestBody request: UpdateQuietHoursRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): QuietHoursDto = operations.updateQuietHours(collectiveId, request, jwt.subject)
}
