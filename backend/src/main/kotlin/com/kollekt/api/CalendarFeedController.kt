package com.kollekt.api

import com.kollekt.service.CalendarFeedService
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Public, unauthenticated iCalendar subscription feed. The path doubles as a capability
 * token (HMAC signature), so calendar apps can fetch it anonymously. Permitted in SecurityConfig.
 */
@RestController
@RequestMapping("/api/calendar-feed")
class CalendarFeedController(
    private val calendarFeedService: CalendarFeedService,
) {
    @GetMapping("/{code}/{token}")
    fun feed(
        @PathVariable code: String,
        @PathVariable token: String,
    ): ResponseEntity<String> {
        val ics = calendarFeedService.buildFeed(code, token)
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("text/calendar; charset=utf-8"))
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"kollekt.ics\"")
            .body(ics)
    }
}
