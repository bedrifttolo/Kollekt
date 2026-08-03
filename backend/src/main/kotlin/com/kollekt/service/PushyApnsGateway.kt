package com.kollekt.service

import com.eatthepath.pushy.apns.ApnsClient
import com.eatthepath.pushy.apns.ApnsClientBuilder
import com.eatthepath.pushy.apns.auth.ApnsSigningKey
import com.eatthepath.pushy.apns.util.SimpleApnsPayloadBuilder
import com.eatthepath.pushy.apns.util.SimpleApnsPushNotification
import com.eatthepath.pushy.apns.util.TokenUtil
import com.kollekt.repository.PushDeviceTokenRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.io.ByteArrayInputStream
import java.util.Base64

enum class ApnsSendResult { SENT, FAILED }

interface ApnsGateway {
    fun sendAlert(
        deviceToken: String,
        title: String,
        body: String,
        route: String,
    ): ApnsSendResult
}

/**
 * Sends alerts via APNs using token-based (.p8/JWT) auth. Safe to construct with blank config
 * (local/dev/test) — [sendAlert] then no-ops instead of throwing, mirroring how
 * [GoogleCalendarService] behaves when its OAuth credentials are unset.
 *
 * Sends are fire-and-forget: this is called inline from [NotificationService]'s save/publish
 * path, which itself runs inside chat/task/expense request handling, so blocking per recipient
 * on an APNs round trip isn't worth the latency it would add to unrelated flows. This class
 * therefore owns [PushDeviceTokenRepository] directly, to delete a token the moment APNs reports
 * it as stale from the async completion callback, rather than threading that decision back
 * through a synchronous return value.
 */
@Component
class PushyApnsGateway(
    @Value("\${app.apns.team-id:}") private val teamId: String,
    @Value("\${app.apns.key-id:}") private val keyId: String,
    @Value("\${app.apns.auth-key-base64:}") private val authKeyBase64: String,
    @Value("\${app.apns.bundle-id:no.kollekt.app}") private val bundleId: String,
    @Value("\${app.apns.production:false}") private val production: Boolean,
    private val pushDeviceTokenRepository: PushDeviceTokenRepository,
) : ApnsGateway {
    private val log = LoggerFactory.getLogger(PushyApnsGateway::class.java)
    private val client: ApnsClient? = buildClient()

    private fun buildClient(): ApnsClient? {
        if (teamId.isBlank() || keyId.isBlank() || authKeyBase64.isBlank()) {
            log.info("APNs not configured (APNS_TEAM_ID/APNS_KEY_ID/APNS_AUTH_KEY_BASE64 unset); push disabled.")
            return null
        }
        return try {
            val signingKey =
                ApnsSigningKey.loadFromInputStream(
                    ByteArrayInputStream(Base64.getDecoder().decode(authKeyBase64)),
                    teamId,
                    keyId,
                )
            ApnsClientBuilder()
                .setApnsServer(
                    if (production) ApnsClientBuilder.PRODUCTION_APNS_HOST else ApnsClientBuilder.DEVELOPMENT_APNS_HOST,
                )
                .setSigningKey(signingKey)
                .build()
        } catch (ex: Exception) {
            log.warn("Failed to build APNs client; push notifications disabled.", ex)
            null
        }
    }

    override fun sendAlert(
        deviceToken: String,
        title: String,
        body: String,
        route: String,
    ): ApnsSendResult {
        val apnsClient = client ?: return ApnsSendResult.FAILED
        val payload =
            SimpleApnsPayloadBuilder()
                .setAlertTitle(title)
                .setAlertBody(body)
                .addCustomProperty("route", route)
                .build()
        val notification = SimpleApnsPushNotification(TokenUtil.sanitizeTokenString(deviceToken), bundleId, payload)

        apnsClient.sendNotification(notification).whenComplete { response, error ->
            when {
                error != null -> log.warn("APNs send failed for a device token", error)
                response == null || response.isAccepted -> Unit
                else -> {
                    val reason = response.rejectionReason.orElse(null)
                    if (reason == "BadDeviceToken" || reason == "Unregistered") {
                        pushDeviceTokenRepository.deleteById(deviceToken)
                    } else {
                        log.warn("APNs rejected notification: {}", reason)
                    }
                }
            }
        }
        return ApnsSendResult.SENT
    }
}
