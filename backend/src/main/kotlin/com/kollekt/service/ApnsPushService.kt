package com.kollekt.service

import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PushDeviceTokenRepository
import org.springframework.stereotype.Service

/**
 * Sends an iOS push alert for a notification that has already passed [NotificationService]'s
 * per-user, per-type [NotificationService.isNotificationEnabled] gate — this class only decides
 * *how* to compose and deliver it, not whether the recipient wants it.
 */
@Service
class ApnsPushService(
    private val pushDeviceTokenRepository: PushDeviceTokenRepository,
    private val memberRepository: MemberRepository,
    private val apnsGateway: ApnsGateway,
) {
    fun sendPush(
        userName: String,
        type: String,
        params: Map<String, String>,
    ) {
        val tokens = pushDeviceTokenRepository.findByMemberName(userName).filter { it.platform == "ios" }
        if (tokens.isEmpty()) return

        val language = memberRepository.findAllByName(userName).firstOrNull()?.language
        val (title, body) = PushNotificationCopy.resolve(language, type, params)
        val route = routeFor(type)

        tokens.forEach { deviceToken ->
            apnsGateway.sendAlert(deviceToken.token, title, body, route)
        }
    }

    private fun routeFor(type: String): String =
        when {
            type.startsWith("TASK_") || type == "SHOPPING_ITEM_ADDED" -> "/tasks"
            type == "NEW_MESSAGE" -> "/chat"
            type.startsWith("EXPENSE_") -> "/economy"
            type == "KUDOS_RECEIVED" || type == "WEEKLY_RECAP" -> "/social"
            type == "EVENT_ADDED" -> "/calendar"
            else -> "/"
        }
}
