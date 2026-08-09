package com.kollekt.service

import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PushDeviceTokenRepository
import org.springframework.stereotype.Service

/**
 * Android counterpart to [ApnsPushService] — same per-type/per-language resolution, routed to
 * FCM instead of APNs.
 */
@Service
class FcmPushService(
    private val pushDeviceTokenRepository: PushDeviceTokenRepository,
    private val memberRepository: MemberRepository,
    private val fcmGateway: FcmGateway,
) {
    fun sendPush(
        userName: String,
        type: String,
        params: Map<String, String>,
    ) {
        val tokens = pushDeviceTokenRepository.findByMemberName(userName).filter { it.platform == "android" }
        if (tokens.isEmpty()) return

        val language = memberRepository.findAllByName(userName).firstOrNull()?.language
        val (title, body) = PushNotificationCopy.resolve(language, type, params)
        val route = PushNotificationCopy.routeFor(type)

        tokens.forEach { deviceToken ->
            fcmGateway.sendAlert(deviceToken.token, title, body, route)
        }
    }
}
