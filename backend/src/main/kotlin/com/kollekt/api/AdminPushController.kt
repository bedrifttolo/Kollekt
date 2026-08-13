package com.kollekt.api

import com.kollekt.service.AppUpdatePushResult
import com.kollekt.service.AppUpdatePushService
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.security.MessageDigest

/**
 * Manual operator trigger for the one-shot app-update broadcast. An endpoint rather than a startup
 * job on purpose: a job would fire at whatever hour the container happens to be deployed, and 03:00
 * push notifications are how an app gets uninstalled. This way it can be dry-run first and fired at
 * a civilised time.
 *
 * This path is intentionally *not* in [com.kollekt.config.SecurityConfig]'s permitAll list, so
 * `anyRequest().authenticated()` already requires a valid JWT; APP_ADMIN_TOKEN is a second factor on
 * top. Inventing a bespoke admin auth scheme under permitAll would be strictly more risk than
 * reusing the authentication that is already there.
 */
@RestController
@RequestMapping("/api/admin")
class AdminPushController(
    @Value("\${app.admin.token:}") private val adminToken: String,
    private val appUpdatePushService: AppUpdatePushService,
) {
    @PostMapping("/app-update-push")
    fun sendAppUpdatePush(
        @RequestHeader("X-Admin-Token") token: String,
        @RequestParam(defaultValue = "ios") platform: String,
        // Defaults to true so a mistyped curl reports a count instead of blasting every device.
        @RequestParam(defaultValue = "true") dryRun: Boolean,
    ): AppUpdatePushResult {
        requireAdmin(token)
        return appUpdatePushService.sendAppUpdatePush(platform, dryRun)
    }

    private fun requireAdmin(token: String) {
        // 404 rather than 401/403 throughout: a wrong or missing token should not confirm that the
        // endpoint exists at all.
        if (adminToken.isBlank()) throw ResponseStatusException(HttpStatus.NOT_FOUND)
        if (!MessageDigest.isEqual(token.toByteArray(), adminToken.toByteArray())) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND)
        }
    }
}
