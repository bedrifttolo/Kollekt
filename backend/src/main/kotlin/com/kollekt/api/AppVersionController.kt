package com.kollekt.api

import com.kollekt.api.dto.AppVersionInfoDto
import org.springframework.beans.factory.annotation.Value
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Unauthenticated so the "update available" overlay can show even on the login screen.
 * Everything here is config-driven (APP_VERSION_*) so versions can be bumped after a store release
 * without a code deploy.
 */
@RestController
class AppVersionController(
    @Value("\${app.version.latest-ios}") private val latestIosVersion: String,
    @Value("\${app.version.ios-store-url}") private val iosStoreUrl: String,
    @Value("\${app.version.min-ios}") private val minIosVersion: String,
    @Value("\${app.version.latest-android}") private val latestAndroidVersion: String,
    @Value("\${app.version.android-store-url}") private val androidStoreUrl: String,
    @Value("\${app.version.min-android}") private val minAndroidVersion: String,
) {
    @GetMapping("/api/app-version")
    fun getAppVersion(): AppVersionInfoDto =
        AppVersionInfoDto(
            latestIosVersion = latestIosVersion,
            iosStoreUrl = iosStoreUrl,
            minIosVersion = minIosVersion,
            latestAndroidVersion = latestAndroidVersion,
            androidStoreUrl = androidStoreUrl,
            minAndroidVersion = minAndroidVersion,
        )
}
