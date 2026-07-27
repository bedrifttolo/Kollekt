package com.kollekt.api

import com.kollekt.service.InvalidRefreshTokenException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class ApiExceptionHandler {
    /**
     * 401, not the 400 an IllegalArgumentException would produce. The client only discards a
     * stored session on 401/403; a 400 here left it retrying a dead token forever.
     */
    @ExceptionHandler(InvalidRefreshTokenException::class)
    fun handleInvalidRefreshToken(ex: InvalidRefreshTokenException): ResponseEntity<Map<String, String>> =
        ResponseEntity
            .status(HttpStatus.UNAUTHORIZED)
            .body(mapOf("error" to (ex.message ?: "Refresh token is invalid or expired")))

    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDenied(ex: AccessDeniedException): ResponseEntity<Map<String, String>> =
        ResponseEntity
            .status(HttpStatus.FORBIDDEN)
            .body(mapOf("error" to (ex.message ?: "Forbidden")))

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleIllegalArgument(ex: IllegalArgumentException): ResponseEntity<Map<String, String>> =
        ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(mapOf("error" to (ex.message ?: "Bad request")))

    @ExceptionHandler(Exception::class)
    fun handleGeneral(ex: Exception): ResponseEntity<Map<String, String>> =
        ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(mapOf("error" to (ex.message ?: "Internal server error")))
}
