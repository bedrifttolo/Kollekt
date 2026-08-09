package com.kollekt.service

import org.springframework.stereotype.Service

/**
 * Single entry point [NotificationService] calls to push to every registered device for a
 * member, regardless of platform — delegates to [ApnsPushService]/[FcmPushService], each of
 * which filters to its own platform's tokens and no-ops if that platform isn't configured.
 */
@Service
class PushDispatchService(
    private val apnsPushService: ApnsPushService,
    private val fcmPushService: FcmPushService,
) {
    fun sendPush(
        userName: String,
        type: String,
        params: Map<String, String>,
    ) {
        apnsPushService.sendPush(userName, type, params)
        fcmPushService.sendPush(userName, type, params)
    }
}
