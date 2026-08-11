package com.kollekt.repository

import com.kollekt.domain.Kudo
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface KudoRepository : JpaRepository<Kudo, Long> {
    fun findAllByCollectiveCodeOrderByCreatedAtDesc(collectiveCode: String): List<Kudo>

    @Query("select count(k) from Kudo k where k.sender = :sender and k.createdAt >= :start and k.createdAt < :end")
    fun countSentInRange(
        @Param("sender") sender: String,
        @Param("start") start: Instant,
        @Param("end") end: Instant,
    ): Long

    @Modifying
    @Query("update Kudo k set k.sender = :newName where k.sender = :oldName and k.collectiveCode = :collectiveCode")
    fun renameSender(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int

    @Modifying
    @Query("update Kudo k set k.receiver = :newName where k.receiver = :oldName and k.collectiveCode = :collectiveCode")
    fun renameReceiver(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
        @Param("collectiveCode") collectiveCode: String,
    ): Int
}
