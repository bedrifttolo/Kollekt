package com.kollekt.repository

import com.kollekt.domain.CollectiveQuietHours
import com.kollekt.domain.GuestNotice
import org.springframework.data.jpa.repository.JpaRepository

interface GuestNoticeRepository : JpaRepository<GuestNotice, Long> {
    fun findAllByCollectiveCodeOrderByDateAscStartTimeAsc(collectiveCode: String): List<GuestNotice>
}

interface CollectiveQuietHoursRepository : JpaRepository<CollectiveQuietHours, Long> {
    fun findByCollectiveCode(collectiveCode: String): CollectiveQuietHours?
}
