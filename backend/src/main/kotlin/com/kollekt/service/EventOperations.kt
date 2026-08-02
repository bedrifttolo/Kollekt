package com.kollekt.service

import com.kollekt.api.dto.CreateEventRequest
import com.kollekt.api.dto.EventDto
import com.kollekt.api.dto.UpdateEventRequest
import com.kollekt.domain.AttendanceStatus
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.EventAttendance
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.EventAttendanceRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.MemberRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class EventOperations(
    private val memberRepository: MemberRepository,
    private val eventRepository: EventRepository,
    private val eventAttendanceRepository: EventAttendanceRepository,
    private val notificationService: NotificationService,
    private val collectiveAccessService: CollectiveAccessService,
    private val googleCalendarService: GoogleCalendarService,
    private val realtimeUpdateService: RealtimeUpdateService,
) {
    fun getEvents(memberName: String): List<EventDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val events = eventRepository.findAllByCollectiveCode(collectiveCode).sortedBy { it.date }
        val attendanceByEvent =
            eventAttendanceRepository
                .findAllByEventIdIn(events.map { it.id })
                .groupBy { it.eventId }
        return events.map { it.toDto(attendanceByEvent[it.id].orEmpty()) }
    }

    /** Records (or clears, when [status] is null) a member's join/pass response to an event. */
    @Transactional
    fun setAttendance(
        eventId: Long,
        actorName: String,
        status: AttendanceStatus?,
    ): EventDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val event =
            eventRepository
                .findById(eventId)
                .orElseThrow { IllegalArgumentException("Event $eventId not found") }

        require(event.collectiveCode == collectiveCode) { "Event not in your collective" }

        val existing = eventAttendanceRepository.findByEventIdAndMemberName(eventId, actorName)
        when {
            status == null -> existing?.let { eventAttendanceRepository.delete(it) }
            existing == null ->
                eventAttendanceRepository.save(
                    EventAttendance(eventId = eventId, memberName = actorName, status = status),
                )
            existing.status != status -> eventAttendanceRepository.save(existing.copy(status = status))
        }

        realtimeUpdateService.publish(collectiveCode, "EVENT_UPDATED", mapOf("eventId" to eventId))
        return event.toDto(eventAttendanceRepository.findAllByEventIdIn(listOf(eventId)))
    }

    @Transactional
    fun createEvent(
        request: CreateEventRequest,
        actorName: String,
    ): EventDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        var saved =
            eventRepository.save(
                CalendarEvent(
                    title = request.title,
                    collectiveCode = collectiveCode,
                    date = request.date,
                    time = request.time,
                    endTime = request.endTime,
                    type = request.type,
                    organizer = actorName,
                    attendees = request.attendees,
                    description = request.description,
                ),
            )

        if (request.syncToGoogle) {
            val member = memberRepository.findByNameAndCollectiveCode(actorName, collectiveCode)
            if (member != null) {
                val googleEventId = googleCalendarService.createGoogleEvent(member, saved)
                if (googleEventId != null) {
                    saved = eventRepository.save(saved.copy(googleEventId = googleEventId))
                }
            }
        }

        val others =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.status == MemberStatus.ACTIVE && it.name != actorName }
                .map { it.name }
        if (others.isNotEmpty()) {
            notificationService.createParameterizedGroupNotification(
                userNames = others,
                type = "EVENT_ADDED",
                params = mapOf("title" to request.title, "date" to request.date.toString()),
            )
        }

        realtimeUpdateService.publish(collectiveCode, "EVENT_CREATED", mapOf("eventId" to saved.id))
        return saved.toDto()
    }

    @Transactional
    fun deleteEvent(
        eventId: Long,
        actorName: String,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val event =
            eventRepository
                .findById(eventId)
                .orElseThrow { IllegalArgumentException("Event $eventId not found") }

        require(event.collectiveCode == collectiveCode) { "Event not in your collective" }

        if (event.googleEventId != null) {
            val member = memberRepository.findByNameAndCollectiveCode(actorName, collectiveCode)
            if (member != null) {
                googleCalendarService.deleteGoogleEvent(member, event.googleEventId)
            }
        }

        eventRepository.delete(event)
        realtimeUpdateService.publish(collectiveCode, "EVENT_DELETED", mapOf("eventId" to eventId))
    }

    @Transactional
    fun updateEvent(
        eventId: Long,
        request: UpdateEventRequest,
        actorName: String,
    ): EventDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val event =
            eventRepository
                .findById(eventId)
                .orElseThrow { IllegalArgumentException("Event $eventId not found") }

        require(event.collectiveCode == collectiveCode) { "Event not in your collective" }

        val updated =
            eventRepository.save(
                event.copy(
                    title = request.title,
                    time = request.time,
                    endTime = request.endTime,
                    type = request.type,
                    description = request.description,
                ),
            )

        realtimeUpdateService.publish(collectiveCode, "EVENT_UPDATED", mapOf("eventId" to eventId))
        return updated.toDto(eventAttendanceRepository.findAllByEventIdIn(listOf(eventId)))
    }

    private fun CalendarEvent.toDto(attendance: List<EventAttendance> = emptyList()) =
        EventDto(
            id,
            title,
            date,
            time,
            endTime,
            type,
            organizer,
            attendees,
            description,
            joining = attendance.filter { it.status == AttendanceStatus.JOINING }.map { it.memberName },
            passing = attendance.filter { it.status == AttendanceStatus.PASSING }.map { it.memberName },
        )
}
