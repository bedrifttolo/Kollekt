package com.kollekt.repository

import com.kollekt.domain.EventAttendance
import org.springframework.data.jpa.repository.JpaRepository

interface EventAttendanceRepository : JpaRepository<EventAttendance, Long> {
    fun findAllByEventIdIn(eventIds: Collection<Long>): List<EventAttendance>

    fun findByEventIdAndMemberName(
        eventId: Long,
        memberName: String,
    ): EventAttendance?
}
