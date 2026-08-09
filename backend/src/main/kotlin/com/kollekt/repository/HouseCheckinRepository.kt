package com.kollekt.repository

import com.kollekt.domain.CheckinResponse
import com.kollekt.domain.HouseCheckin
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
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

    @Modifying
    @Query(
        "update CheckinResponse r set r.memberName = :newName where r.memberName = :oldName and " +
            "r.checkinId in (select c.id from HouseCheckin c where c.collectiveCode = :collectiveCode)",
    )
    fun renameMemberName(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
