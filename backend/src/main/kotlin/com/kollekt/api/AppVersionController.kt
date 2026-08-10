package com.kollekt.api

import com.kollekt.api.dto.AppVersionInfoDto
import org.springframework.beans.factory.annotation.Value
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Unauthenticated so the "update available" overlay can show even on the login screen.
 * latestIosVersion is config-driven (APP_VERSION_LATEST_IOS) so it can be bumped after an
 * App Store release without a code deploy.
 */
@RestController
class AppVersionController(
    @Value("\${app.version.latest-ios}") private val latestIosVersion: String,
    @Value("\${app.version.ios-store-url}") private val iosStoreUrl: String,
) {
    @GetMapping("/api/app-version")
    fun getAppVersion(): AppVersionInfoDto = AppVersionInfoDto(latestIosVersion, iosStoreUrl)
}
