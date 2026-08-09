package com.kollekt.repository

import com.kollekt.domain.CollectiveQuietHours
import com.kollekt.domain.GuestNotice
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface GuestNoticeRepository : JpaRepository<GuestNotice, Long> {
    fun findAllByCollectiveCodeOrderByDateAscStartTimeAsc(collectiveCode: String): List<GuestNotice>

    @Modifying
    @Query("update GuestNotice g set g.createdBy = :newName where g.createdBy = :oldName and g.collectiveCode = :collectiveCode")
    fun renameCreatedBy(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}

interface CollectiveQuietHoursRepository : JpaRepository<CollectiveQuietHours, Long> {
    fun findByCollectiveCode(collectiveCode: String): CollectiveQuietHours?
}
