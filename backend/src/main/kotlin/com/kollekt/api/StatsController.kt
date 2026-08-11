package com.kollekt.api

import com.kollekt.api.dto.AchievementCatalogItemDto
import com.kollekt.api.dto.AchievementDto
import com.kollekt.api.dto.CreateCustomAchievementRequest
import com.kollekt.api.dto.DashboardResponse
import com.kollekt.api.dto.LeaderboardPeriod
import com.kollekt.api.dto.LeaderboardResponse
import com.kollekt.api.dto.MemberStatsDto
import com.kollekt.api.dto.MonthlyPrizeRequest
import com.kollekt.api.dto.UpdateAchievementConfigRequest
import com.kollekt.service.CurrentMemberContext
import com.kollekt.service.StatsService
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class StatsController(
    private val statsService: StatsService,
    private val currentMemberContext: CurrentMemberContext,
) {
    @GetMapping("/dashboard")
    fun getDashboard(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): DashboardResponse {
        currentMemberContext.requireTokenSubject(jwt, memberName)
        return statsService.getDashboard(memberName)
    }

    @GetMapping("/leaderboard")
    fun getLeaderboard(
        @RequestParam memberName: String,
        @RequestParam(defaultValue = "MONTH") period: LeaderboardPeriod,
        @AuthenticationPrincipal jwt: Jwt,
    ): LeaderboardResponse {
        currentMemberContext.requireTokenSubject(jwt, memberName)
        return statsService.getLeaderboard(memberName, period)
    }

    @GetMapping("/fairness")
    fun getFairness(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): com.kollekt.api.dto.FairnessDto {
        currentMemberContext.requireTokenSubject(jwt, memberName)
        return statsService.getFairness(memberName)
    }

    @GetMapping("/monthly-prize")
    fun getMonthlyPrize(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): String? {
        currentMemberContext.requireTokenSubject(jwt, memberName)
        return statsService.getMonthlyPrize(memberName)
    }

    @PostMapping("/monthly-prize")
    fun setMonthlyPrize(
        @RequestParam memberName: String,
        @RequestBody request: MonthlyPrizeRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        currentMemberContext.requireTokenSubject(jwt, memberName)
        statsService.setMonthlyPrize(memberName, request.prize)
    }

    @GetMapping("/achievements")
    fun getAchievements(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<AchievementDto> {
        currentMemberContext.requireTokenSubject(jwt, memberName)
        return statsService.getAchievements(memberName)
    }

    @GetMapping("/achievements/catalog")
    fun getAchievementsCatalog(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<AchievementCatalogItemDto> {
        currentMemberContext.requireTokenSubject(jwt, memberName)
        return statsService.getAchievementsCatalog(memberName)
    }

    @PatchMapping("/achievements/config")
    fun updateAchievementConfig(
        @RequestParam memberName: String,
        @RequestBody request: UpdateAchievementConfigRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        currentMemberContext.requireTokenSubject(jwt, memberName)
        statsService.updateAchievementConfig(memberName, request.enabledKeys)
    }

    @PostMapping("/achievements/custom")
    @ResponseStatus(HttpStatus.CREATED)
    fun createCustomAchievement(
        @RequestParam memberName: String,
        @RequestBody request: CreateCustomAchievementRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): AchievementDto {
        currentMemberContext.requireTokenSubject(jwt, memberName)
        return statsService.createCustomAchievement(memberName, request)
    }

    @DeleteMapping("/achievements/custom/{achievementId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteCustomAchievement(
        @PathVariable achievementId: Long,
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        currentMemberContext.requireTokenSubject(jwt, memberName)
        statsService.deleteCustomAchievement(memberName, achievementId)
    }

    @GetMapping("/members/stats")
    fun getMemberStats(
        @RequestParam viewerName: String,
        @RequestParam targetName: String,
        // Mirrors /leaderboard's period so the sheet reports the same numbers as the row that
        // was tapped. The monthly view is the standard social view.
        @RequestParam(defaultValue = "MONTH") period: LeaderboardPeriod,
        @AuthenticationPrincipal jwt: Jwt,
    ): MemberStatsDto {
        currentMemberContext.requireTokenSubject(jwt, viewerName)
        return statsService.getMemberStats(viewerName, targetName, period)
    }
}
