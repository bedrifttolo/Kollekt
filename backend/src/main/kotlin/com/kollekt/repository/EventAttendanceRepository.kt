package com.kollekt.repository

import com.kollekt.domain.EventAttendance
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface EventAttendanceRepository : JpaRepository<EventAttendance, Long> {
    fun findAllByEventIdIn(eventIds: Collection<Long>): List<EventAttendance>

    fun findByEventIdAndMemberName(
        eventId: Long,
        memberName: String,
    ): EventAttendance?

    @Modifying
    @Query(
        "update EventAttendance a set a.memberName = :newName where a.memberName = :oldName and " +
            "a.eventId in (select e.id from CalendarEvent e where e.collectiveCode = :collectiveCode)",
    )
    fun renameMemberName(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
