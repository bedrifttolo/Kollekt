package com.kollekt.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.kollekt.domain.Member
import com.kollekt.domain.Notification
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.NotificationRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

val ALL_NOTIFICATION_TYPES =
    listOf(
        "TASK_ASSIGNED",
        "TASK_DEADLINE_SOON",
        "TASK_OVERDUE",
        "TASK_NUDGE",
        "TASK_FEEDBACK",
        "TASK_COMPLETED_LATE",
        "TASK_OVERDUE_GROUP",
        "TASK_PENALTY_APPLIED",
        "WEEKLY_RECAP",
        "TASK_SWAP_REQUESTED",
        "TASK_SWAP_ACCEPTED",
        "TASK_SWAP_DECLINED",
        "KUDOS_RECEIVED",
        "NEW_MESSAGE",
        "EXPENSE_OWED",
        "EXPENSE_DEADLINE_SOON",
        "EXPENSE_OVERDUE",
        "SHOPPING_ITEM_ADDED",
        "EVENT_ADDED",
        "HOUSE_RULES_UPDATED",
        "GUEST_NOTICE_CREATED",
        "GUEST_QUIET_HOURS_OVERLAP",
        "QUIET_HOURS_VIOLATION",
        "HOUSE_RULE_VIOLATION",
    )

@Service
class NotificationService(
    private val notificationRepository: NotificationRepository,
    private val memberRepository: MemberRepository,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val pushDispatchService: PushDispatchService,
) {
    private val objectMapper = jacksonObjectMapper()

    /** Callers here only have a bare recipient name, not a collectiveCode — resolving via
     *  [MemberRepository.findByName] would throw if two members happen to share that name in
     *  different households. Falling back to the first match trades a rare wrong-preference/
     *  wrong-channel notification glitch for never hard-failing a notification send; a full fix
     *  would thread collectiveCode through every notification call site. */
    private fun findMemberByName(name: String): Member? = memberRepository.findAllByName(name).firstOrNull()

    fun isNotificationEnabled(
        userName: String,
        type: String,
    ): Boolean {
        val member = findMemberByName(userName) ?: return true
        val prefsJson = member.notificationPreferences ?: return true
        return try {
            val prefs = objectMapper.readValue<Map<String, Boolean>>(prefsJson)
            prefs[type] ?: true
        } catch (_: Exception) {
            true
        }
    }

    fun getPreferences(userName: String): Map<String, Boolean> {
        val member =
            findMemberByName(userName)
                ?: return ALL_NOTIFICATION_TYPES.associateWith { true }
        val prefsJson =
            member.notificationPreferences
                ?: return ALL_NOTIFICATION_TYPES.associateWith { true }
        return try {
            val prefs = objectMapper.readValue<Map<String, Boolean>>(prefsJson)
            ALL_NOTIFICATION_TYPES.associateWith { type -> prefs[type] ?: true }
        } catch (_: Exception) {
            ALL_NOTIFICATION_TYPES.associateWith { true }
        }
    }

    @Transactional
    fun updatePreferences(
        userName: String,
        prefs: Map<String, Boolean>,
    ) {
        val member = findMemberByName(userName) ?: return
        val sanitized = ALL_NOTIFICATION_TYPES.associateWith { type -> prefs[type] ?: true }
        memberRepository.save(member.copy(notificationPreferences = objectMapper.writeValueAsString(sanitized)))
    }

    private fun saveAndPublish(notification: Notification) {
        notificationRepository.save(notification)
        pushDispatchService.sendPush(notification.userName, notification.type, messageParams(notification.message))
        val collectiveCode = findMemberByName(notification.userName)?.collectiveCode ?: return
        realtimeUpdateService.publish(
            collectiveCode,
            "NOTIFICATION_CREATED",
            mapOf("userName" to notification.userName, "type" to notification.type),
        )
    }

    /** [Notification.message] is JSON for the parameterized/task-assigned paths and a plain
     *  string for [createCustomNotification]; either way this recovers a params map for
     *  [PushNotificationCopy] to interpolate. */
    private fun messageParams(message: String): Map<String, String> =
        try {
            objectMapper.readValue<Map<String, String>>(message)
        } catch (_: Exception) {
            mapOf("message" to message)
        }

    @Transactional
    fun createTaskAssignedNotification(
        userName: String,
        taskTitle: String,
    ) {
        if (!isNotificationEnabled(userName, "TASK_ASSIGNED")) return
        saveAndPublish(
            Notification(
                userName = userName,
                message = objectMapper.writeValueAsString(mapOf("title" to taskTitle)),
                type = "TASK_ASSIGNED",
                timestamp = Instant.now(),
                read = false,
            ),
        )
    }

    fun createCustomNotification(
        userName: String,
        message: String,
        type: String,
    ) {
        if (!isNotificationEnabled(userName, type)) return
        saveAndPublish(
            Notification(
                userName = userName,
                message = message,
                type = type,
                timestamp = Instant.now(),
                read = false,
            ),
        )
    }

    fun createParameterizedNotification(
        userName: String,
        type: String,
        params: Map<String, String>,
    ) {
        if (!isNotificationEnabled(userName, type)) return
        saveAndPublish(
            Notification(
                userName = userName,
                message = objectMapper.writeValueAsString(params),
                type = type,
                timestamp = Instant.now(),
                read = false,
            ),
        )
    }

    fun createGroupNotification(
        userNames: List<String>,
        message: String,
        type: String,
    ) {
        val enabled = userNames.filter { isNotificationEnabled(it, type) }
        if (enabled.isEmpty()) return
        val now = Instant.now()
        val notifications =
            enabled.map { userName ->
                Notification(userName = userName, message = message, type = type, timestamp = now, read = false)
            }
        notificationRepository.saveAll(notifications)
        enabled.forEach { userName -> pushDispatchService.sendPush(userName, type, mapOf("message" to message)) }
        val collectiveCodes = enabled.mapNotNull { findMemberByName(it)?.collectiveCode }.distinct()
        for (code in collectiveCodes) {
            realtimeUpdateService.publish(code, "NOTIFICATION_CREATED", mapOf("type" to type))
        }
    }

    fun createParameterizedGroupNotification(
        userNames: List<String>,
        type: String,
        params: Map<String, String>,
    ) {
        val enabled = userNames.filter { isNotificationEnabled(it, type) }
        if (enabled.isEmpty()) return
        val messageJson = objectMapper.writeValueAsString(params)
        val now = Instant.now()
        val notifications =
            enabled.map { userName ->
                Notification(userName = userName, message = messageJson, type = type, timestamp = now, read = false)
            }
        notificationRepository.saveAll(notifications)
        enabled.forEach { userName -> pushDispatchService.sendPush(userName, type, params) }
        val collectiveCodes = enabled.mapNotNull { findMemberByName(it)?.collectiveCode }.distinct()
        for (code in collectiveCodes) {
            realtimeUpdateService.publish(code, "NOTIFICATION_CREATED", mapOf("type" to type))
        }
    }

    fun getNotificationsForUser(userName: String): List<Notification> = notificationRepository.findAllByUserName(userName)

    @Transactional
    fun markAllAsRead(userName: String) {
        val notifications = notificationRepository.findAllByUserName(userName)
        notifications.forEach { notificationRepository.save(it.copy(read = true)) }
    }

    @Transactional
    fun deleteNotification(
        userName: String,
        id: Long,
    ) {
        notificationRepository.deleteByIdAndUserName(id, userName)
    }

    @Transactional
    fun deleteAllNotifications(userName: String) {
        notificationRepository.deleteAllByUserName(userName)
    }
}
