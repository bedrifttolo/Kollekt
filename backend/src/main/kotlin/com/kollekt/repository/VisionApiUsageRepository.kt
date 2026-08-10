package com.kollekt.repository

import com.kollekt.domain.VisionApiUsage
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface VisionApiUsageRepository : JpaRepository<VisionApiUsage, Long> {
    fun findByPeriod(period: String): VisionApiUsage?

    // Upsert so concurrent first-calls-of-the-month don't race on the unique(period) constraint.
    @Modifying
    @Query(
        value =
            """
            insert into vision_api_usage (period, call_count)
            values (:period, 1)
            on conflict (period) do update set call_count = vision_api_usage.call_count + 1
            """,
        nativeQuery = true,
    )
    fun incrementForPeriod(
        @Param("period") period: String,
    )
}
