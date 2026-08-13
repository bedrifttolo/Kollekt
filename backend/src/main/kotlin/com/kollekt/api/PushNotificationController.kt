package com.kollekt.api

import com.kollekt.domain.PushDeviceToken
import com.kollekt.repository.PushDeviceTokenRepository
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

@RestController
@RequestMapping("/api/push")
class PushNotificationController(
    private val pushDeviceTokenRepository: PushDeviceTokenRepository,
) {
    data class DeviceTokenRequest(
        val token: String,
        val platform: String,
        // Absent from clients older than the build that introduced it — that absence is the signal.
        val appVersion: String? = null,
    )

    @PostMapping("/device-token")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun registerDeviceToken(
        @RequestBody request: DeviceTokenRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        require(request.token.isNotBlank() && request.platform.isNotBlank())
        // Read-modify-write rather than constructing a fresh entity: re-registration happens on
        // every session restore, and rebuilding the row would reset appUpdatePushSentAt to null on
        // every app launch — turning the one-shot update broadcast into a repeat blast. That field
        // is deliberately absent from the copy below so it survives.
        val existing = pushDeviceTokenRepository.findById(request.token).orElse(null)
        pushDeviceTokenRepository.save(
            existing?.copy(
                memberName = jwt.subject,
                platform = request.platform,
                appVersion = request.appVersion,
                updatedAt = Instant.now(),
            )
                ?: PushDeviceToken(
                    token = request.token,
                    memberName = jwt.subject,
                    platform = request.platform,
                    updatedAt = Instant.now(),
                    appVersion = request.appVersion,
                ),
        )
    }

    @DeleteMapping("/device-token")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeDeviceToken(
        @RequestParam token: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        pushDeviceTokenRepository.findById(token).ifPresent { entry ->
            if (entry.memberName == jwt.subject) {
                pushDeviceTokenRepository.delete(entry)
            }
        }
    }
}
