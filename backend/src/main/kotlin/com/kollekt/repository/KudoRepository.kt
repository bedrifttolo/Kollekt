package com.kollekt.repository

import com.kollekt.domain.Kudo
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface KudoRepository : JpaRepository<Kudo, Long> {
    fun findAllByCollectiveCodeOrderByCreatedAtDesc(collectiveCode: String): List<Kudo>

    @Query("select count(k) from Kudo k where k.sender = :sender and k.createdAt >= :start and k.createdAt < :end")
    fun countSentInRange(
        @Param("sender") sender: String,
        @Param("start") start: LocalDateTime,
        @Param("end") end: LocalDateTime,
    ): Long
}
