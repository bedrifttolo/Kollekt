@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.api

import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.EventAttendanceRequest
import com.kollekt.api.dto.EventDto
import com.kollekt.api.dto.UpdateEventRequest
import com.kollekt.service.CalendarFeedService
import com.kollekt.service.EventOperations
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/events")
class CalendarController(
    private val eventOperations: EventOperations,
    private val calendarFeedService: CalendarFeedService,
) {
    @GetMapping
    fun getEvents(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<EventDto> {
        requireTokenSubject(jwt, memberName)
        return eventOperations.getEvents(memberName)
    }

    @GetMapping("/calendar-feed")
    fun calendarFeed(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): Map<String, String> {
        requireTokenSubject(jwt, memberName)
        return mapOf("path" to calendarFeedService.feedPathForMember(memberName))
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createEvent(
        @RequestBody request: CreateEventRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): EventDto = eventOperations.createEvent(request, jwt.subject)

    @PatchMapping("/{id}")
    fun updateEvent(
        @PathVariable id: Long,
        @RequestBody request: UpdateEventRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): EventDto = eventOperations.updateEvent(id, request, jwt.subject)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteEvent(
        @PathVariable id: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ) = eventOperations.deleteEvent(id, jwt.subject)

    @PostMapping("/{id}/attendance")
    fun setAttendance(
        @PathVariable id: Long,
        @RequestBody request: EventAttendanceRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): EventDto = eventOperations.setAttendance(id, jwt.subject, request.status)
}
