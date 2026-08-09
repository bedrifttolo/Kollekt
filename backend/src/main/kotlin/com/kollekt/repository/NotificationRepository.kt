package com.kollekt.repository

import com.kollekt.domain.Notification
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface NotificationRepository : JpaRepository<Notification, Long> {
    fun findAllByUserName(userName: String): List<Notification>

    fun deleteByIdAndUserName(
        id: Long,
        userName: String,
    )

    fun deleteAllByUserName(userName: String)

    // No collective_code column; matches the existing unscoped findAllByUserName/deleteAllByUserName
    // above in accepting the same narrow cross-household risk.
    @Modifying
    @Query("update Notification n set n.userName = :newName where n.userName = :oldName")
    fun renameUserName(
        @Param("oldName") oldName: String,
        @Param("newName") newName: String,
    ): Int
}
