package com.kollekt.api

import com.kollekt.api.dto.CreateTaskSwapRequest
import com.kollekt.api.dto.TaskSwapRequestDto
import com.kollekt.api.dto.UpdateTaskSwapRequest
import com.kollekt.service.TaskSwapOperations
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
class TaskSwapRequestController(
    private val taskSwapOperations: TaskSwapOperations,
) {
    @PostMapping("/api/tasks/{taskId}/swap-requests")
    @ResponseStatus(HttpStatus.CREATED)
    fun createSwapRequest(
        @PathVariable taskId: Long,
        @RequestBody request: CreateTaskSwapRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskSwapRequestDto = taskSwapOperations.createRequest(taskId, request.toUser, jwt.subject)

    @PatchMapping("/api/swap-requests/{requestId}")
    fun resolveSwapRequest(
        @PathVariable requestId: Long,
        @RequestBody request: UpdateTaskSwapRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): TaskSwapRequestDto = taskSwapOperations.resolveRequest(requestId, request.status, jwt.subject)

    @GetMapping("/api/users/{userId}/swap-requests")
    fun getSwapRequests(
        @PathVariable userId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<TaskSwapRequestDto> = taskSwapOperations.getRequestsForUser(userId, jwt.subject)
}
