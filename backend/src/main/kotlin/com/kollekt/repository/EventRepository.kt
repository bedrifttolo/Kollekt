package com.kollekt.repository

import com.kollekt.domain.CalendarEvent
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface EventRepository : JpaRepository<CalendarEvent, Long> {
    fun findAllByCollectiveCode(collectiveCode: String): List<CalendarEvent>

    @Modifying
    @Query("update CalendarEvent e set e.organizer = :newName where e.organizer = :oldName and e.collectiveCode = :collectiveCode")
    fun renameOrganizer(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
