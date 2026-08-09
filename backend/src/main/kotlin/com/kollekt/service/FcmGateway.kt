package com.kollekt.service

import com.google.api.core.ApiFutureCallback
import com.google.api.core.ApiFutures
import com.google.auth.oauth2.GoogleCredentials
import com.google.common.util.concurrent.MoreExecutors
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingException
import com.google.firebase.messaging.Message
import com.google.firebase.messaging.MessagingErrorCode
import com.kollekt.repository.PushDeviceTokenRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.io.ByteArrayInputStream
import java.util.Base64
import com.google.firebase.messaging.Notification as FcmNotification

enum class FcmSendResult { SENT, FAILED }

interface FcmGateway {
    fun sendAlert(
        deviceToken: String,
        title: String,
        body: String,
        route: String,
    ): FcmSendResult
}

/**
 * Sends alerts via Firebase Cloud Messaging. Safe to construct with blank config (local/dev/
 * test) — [sendAlert] then no-ops instead of throwing, mirroring how [PushyApnsGateway] handles
 * unset APNs config.
 *
 * Sends are fire-and-forget for the same reason as [PushyApnsGateway]: called inline from
 * [NotificationService]'s save/publish path, so blocking per recipient on an FCM round trip
 * isn't worth the latency it would add to unrelated request flows. This class owns
 * [PushDeviceTokenRepository] directly to delete a token the moment FCM reports it as stale from
 * the async completion callback.
 */
@Component
class FirebaseFcmGateway(
    @Value("\${app.fcm.credentials-base64:}") private val credentialsBase64: String,
    private val pushDeviceTokenRepository: PushDeviceTokenRepository,
) : FcmGateway {
    private val log = LoggerFactory.getLogger(FirebaseFcmGateway::class.java)
    private val firebaseApp: FirebaseApp? = buildApp()

    private fun buildApp(): FirebaseApp? {
        if (credentialsBase64.isBlank()) {
            log.info("FCM not configured (FCM_CREDENTIALS_BASE64 unset); Android push disabled.")
            return null
        }
        return try {
            val credentials =
                GoogleCredentials.fromStream(ByteArrayInputStream(Base64.getDecoder().decode(credentialsBase64)))
            val options = FirebaseOptions.builder().setCredentials(credentials).build()
            FirebaseApp.getApps().find { it.name == APP_NAME } ?: FirebaseApp.initializeApp(options, APP_NAME)
        } catch (ex: Exception) {
            log.warn("Failed to initialize Firebase app; Android push notifications disabled.", ex)
            null
        }
    }

    override fun sendAlert(
        deviceToken: String,
        title: String,
        body: String,
        route: String,
    ): FcmSendResult {
        val app = firebaseApp ?: return FcmSendResult.FAILED
        val message =
            Message.builder()
                .setToken(deviceToken)
                .setNotification(FcmNotification.builder().setTitle(title).setBody(body).build())
                .putData("route", route)
                .build()

        val future = FirebaseMessaging.getInstance(app).sendAsync(message)
        ApiFutures.addCallback(
            future,
            object : ApiFutureCallback<String> {
                override fun onSuccess(result: String?) = Unit

                override fun onFailure(throwable: Throwable) {
                    val reason = (throwable as? FirebaseMessagingException)?.messagingErrorCode
                    if (reason == MessagingErrorCode.UNREGISTERED ||
                        reason == MessagingErrorCode.INVALID_ARGUMENT ||
                        reason == MessagingErrorCode.SENDER_ID_MISMATCH
                    ) {
                        pushDeviceTokenRepository.deleteById(deviceToken)
                    } else {
                        log.warn("FCM send failed for a device token", throwable)
                    }
                }
            },
            MoreExecutors.directExecutor(),
        )
        return FcmSendResult.SENT
    }

    private companion object {
        const val APP_NAME = "kollekt-fcm"
    }
}
