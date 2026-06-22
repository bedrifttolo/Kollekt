package com.kollekt.repository

import com.kollekt.domain.CheckinResponse
import com.kollekt.domain.HouseCheckin
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface HouseCheckinRepository : JpaRepository<HouseCheckin, Long> {
    fun findByCollectiveCodeAndWeekStart(
        collectiveCode: String,
        weekStart: LocalDate,
    ): HouseCheckin?
}

interface CheckinResponseRepository : JpaRepository<CheckinResponse, Long> {
    fun findAllByCheckinIdOrderById(checkinId: Long): List<CheckinResponse>

    fun existsByCheckinIdAndMemberName(
        checkinId: Long,
        memberName: String,
    ): Boolean
}
