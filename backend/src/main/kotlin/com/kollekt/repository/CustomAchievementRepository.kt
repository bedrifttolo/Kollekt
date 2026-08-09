package com.kollekt.repository

import com.kollekt.domain.CustomAchievement
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface CustomAchievementRepository : JpaRepository<CustomAchievement, Long> {
    fun findAllByCollectiveCodeOrderByIdAsc(collectiveCode: String): List<CustomAchievement>

    fun findByIdAndCollectiveCode(
        id: Long,
        collectiveCode: String,
    ): CustomAchievement?

    @Modifying
    @Query("update CustomAchievement a set a.createdBy = :newName where a.createdBy = :oldName and a.collectiveCode = :collectiveCode")
    fun renameCreatedBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
