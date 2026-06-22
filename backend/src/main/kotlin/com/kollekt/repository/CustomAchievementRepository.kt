package com.kollekt.repository

import com.kollekt.domain.CustomAchievement
import org.springframework.data.jpa.repository.JpaRepository

interface CustomAchievementRepository : JpaRepository<CustomAchievement, Long> {
    fun findAllByCollectiveCodeOrderByIdAsc(collectiveCode: String): List<CustomAchievement>

    fun findByIdAndCollectiveCode(
        id: Long,
        collectiveCode: String,
    ): CustomAchievement?
}
