package com.kollekt.api

import com.kollekt.api.dto.CreateMaintenanceTicketRequest
import com.kollekt.api.dto.MaintenanceTicketDto
import com.kollekt.api.dto.UpdateMaintenanceTicketRequest
import com.kollekt.domain.MaintenancePriority
import com.kollekt.domain.MaintenanceStatus
import com.kollekt.service.MaintenanceTicketOperations
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
class MaintenanceTicketController(
    private val operations: MaintenanceTicketOperations,
) {
    @PostMapping("/api/maintenance/tickets")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @RequestBody request: CreateMaintenanceTicketRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): MaintenanceTicketDto = operations.create(request, jwt.subject)

    @PatchMapping("/api/maintenance/tickets/{ticketId}")
    fun update(
        @PathVariable ticketId: Long,
        @RequestBody request: UpdateMaintenanceTicketRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): MaintenanceTicketDto = operations.update(ticketId, request, jwt.subject)

    @GetMapping("/api/maintenance/tickets")
    fun getAll(
        @RequestParam(required = false) status: MaintenanceStatus?,
        @RequestParam(required = false) priority: MaintenancePriority?,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<MaintenanceTicketDto> = operations.getAll(jwt.subject, status, priority)
}
