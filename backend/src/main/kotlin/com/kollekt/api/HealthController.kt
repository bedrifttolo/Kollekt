package com.kollekt.api

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Lightweight, unauthenticated liveness endpoint. Pinged by the keep-alive workflow
 * (.github/workflows/keepalive.yml) to prevent the free-tier host from spinning down,
 * which otherwise forces a slow cold start on the next request (e.g. login).
 */
@RestController
class HealthController {
    @GetMapping("/api/health")
    fun health(): Map<String, String> = mapOf("status" to "ok")
}
