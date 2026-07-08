package com.kollekt.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.filter.OncePerRequestFilter
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * Per-IP fixed-window rate limiter for the unauthenticated onboarding endpoints
 * (register, login, OAuth, refresh, password-reset). It throttles credential-stuffing
 * and brute-force attempts before they reach the controllers.
 *
 * In-memory and single-instance by design — this matches the current single-service
 * deployment. If the backend is ever scaled to multiple instances, move the counters to
 * a shared store (e.g. Redis) so the limit is enforced across replicas.
 */
class AuthRateLimitFilter(
    private val maxRequestsPerMinute: Int,
) : OncePerRequestFilter() {
    private class Window(
        @Volatile var startMs: Long,
        val count: AtomicInteger,
    )

    private val windowMs = 60_000L
    private val maxTrackedIps = 10_000
    private val buckets = ConcurrentHashMap<String, Window>()
    private val lastCleanupMs = AtomicLong(System.currentTimeMillis())

    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        !(request.method == "POST" && request.requestURI.startsWith("/api/onboarding/"))

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val now = System.currentTimeMillis()
        cleanupIfNeeded(now)

        val window =
            buckets.compute(clientIp(request)) { _, existing ->
                if (existing == null || now - existing.startMs >= windowMs) {
                    Window(now, AtomicInteger(1))
                } else {
                    existing.count.incrementAndGet()
                    existing
                }
            }!!

        if (window.count.get() > maxRequestsPerMinute) {
            val retryAfterSeconds = ((windowMs - (now - window.startMs)) / 1000).coerceAtLeast(1)
            response.status = HttpStatus.TOO_MANY_REQUESTS.value()
            response.setHeader("Retry-After", retryAfterSeconds.toString())
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            response.writer.write(
                """{"error":"rate_limited","message":"Too many requests. Please try again shortly."}""",
            )
            return
        }

        filterChain.doFilter(request, response)
    }

    /** Real client IP behind Render's proxy is the first entry of X-Forwarded-For. */
    private fun clientIp(request: HttpServletRequest): String {
        val forwarded = request.getHeader("X-Forwarded-For")
        if (!forwarded.isNullOrBlank()) {
            return forwarded.substringBefore(',').trim()
        }
        return request.remoteAddr ?: "unknown"
    }

    /** Bounds memory by dropping expired windows once per window, or eagerly under IP-spray. */
    private fun cleanupIfNeeded(now: Long) {
        if (buckets.size < maxTrackedIps) {
            val last = lastCleanupMs.get()
            if (now - last < windowMs) return
            if (!lastCleanupMs.compareAndSet(last, now)) return
        }
        buckets.entries.removeIf { now - it.value.startMs >= windowMs }
    }
}
