package com.kollekt.service

import com.kollekt.repository.MemberRepository
import com.kollekt.repository.PushDeviceTokenRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.Instant

data class AppUpdatePushResult(
    val platform: String,
    val candidates: Int,
    val sent: Int,
)

/**
 * One-shot broadcast telling every registered device that a new app version is out.
 *
 * This exists because the in-app [update overlay][com.kollekt.api.AppVersionController] can only
 * reach installs whose bundle already contains the overlay code. The 1.0 iOS binary predates it, so
 * those users had no way to learn 1.1 existed — push is the only channel their build does have.
 *
 * It deliberately does **not** filter on `appVersion`: that column is only populated by builds that
 * ship the reporting code, so until such a build has been live for weeks, "null version" means
 * "anyone older than the newest release", not "anyone stale". Broadcasting to everyone sends one
 * redundant notification to up-to-date users in exchange for reaching effectively all the stranded
 * ones, which is why the copy is worded to stay true for someone already on the newest version.
 *
 * Unlike [ApnsPushService]/[FcmPushService] this calls the gateways directly rather than going
 * through [NotificationService], so the per-user notification-preference gate never applies — a user
 * must not be able to opt out of the message that unbricks their install.
 */
@Service
class AppUpdatePushService(
    private val pushDeviceTokenRepository: PushDeviceTokenRepository,
    private val memberRepository: MemberRepository,
    private val apnsGateway: ApnsGateway,
    private val fcmGateway: FcmGateway,
    @Value("\${app.version.latest-ios}") private val latestIosVersion: String,
    @Value("\${app.version.latest-android}") private val latestAndroidVersion: String,
) {
    private val log = LoggerFactory.getLogger(AppUpdatePushService::class.java)

    /**
     * @param dryRun when true, reports how many devices *would* be pushed and sends nothing.
     * @throws IllegalArgumentException for an unknown platform, or one whose configured latest
     *   version is still the inert `0` — announcing "Kollekt 0 is out" to a store listing that does
     *   not exist yet is worse than refusing.
     */
    fun sendAppUpdatePush(
        platform: String,
        dryRun: Boolean,
    ): AppUpdatePushResult {
        val version = latestVersionFor(platform)
        require(version.isNotBlank() && version != "0") {
            "No live version configured for platform '$platform'; refusing to broadcast."
        }

        val candidates = pushDeviceTokenRepository.findByPlatformAndAppUpdatePushSentAtIsNull(platform)
        if (dryRun) {
            log.info("App-update push dry run for {}: {} candidate device(s).", platform, candidates.size)
            return AppUpdatePushResult(platform, candidates.size, sent = 0)
        }

        val store = if (platform == PLATFORM_ANDROID) "Google Play" else "App Store"
        // Resolve each member's language once, not once per device.
        val languages = mutableMapOf<String, String?>()
        var sent = 0

        // Iterating devices rather than members is the point: PushDispatchService would fan out to
        // every device a member owns, including ones already running the newest build.
        candidates.forEach { device ->
            val language =
                languages.getOrPut(device.memberName) {
                    memberRepository.findAllByName(device.memberName).firstOrNull()?.language
                }
            val (title, body) =
                PushNotificationCopy.resolve(
                    language,
                    "APP_UPDATE_AVAILABLE",
                    mapOf("version" to version, "store" to store),
                )

            // Empty route on purpose. The tap handler baked into old builds navigates whenever the
            // route starts with "/", and sending "/" would trigger a full webview reload that reads
            // as a crash. "" just opens the app; the body itself points at the store.
            when (platform) {
                PLATFORM_ANDROID -> fcmGateway.sendAlert(device.token, title, body, "")
                else -> apnsGateway.sendAlert(device.token, title, body, "")
            }

            // Stamp regardless of the send result: a rare missed delivery is a far better failure
            // than re-blasting a device on the next run.
            pushDeviceTokenRepository.save(device.copy(appUpdatePushSentAt = Instant.now()))
            sent++
        }

        log.info("App-update push for {} ({}): {} of {} device(s) sent.", platform, version, sent, candidates.size)
        return AppUpdatePushResult(platform, candidates.size, sent)
    }

    private fun latestVersionFor(platform: String): String =
        when (platform) {
            PLATFORM_IOS -> latestIosVersion
            PLATFORM_ANDROID -> latestAndroidVersion
            else -> throw IllegalArgumentException("Unknown platform '$platform'.")
        }

    private companion object {
        const val PLATFORM_IOS = "ios"
        const val PLATFORM_ANDROID = "android"
    }
}
