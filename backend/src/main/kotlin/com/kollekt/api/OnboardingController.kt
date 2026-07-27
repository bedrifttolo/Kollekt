package com.kollekt.api

import com.kollekt.api.dto.AuthResponse
import com.kollekt.api.dto.CollectiveCodeDto
import com.kollekt.api.dto.CollectiveDto
import com.kollekt.api.dto.CreateCollectiveRequest
import com.kollekt.api.dto.JoinCollectiveRequest
import com.kollekt.api.dto.LogoutRequest
import com.kollekt.api.dto.RefreshTokenRequest
import com.kollekt.api.dto.SocialLoginRequest
import com.kollekt.api.dto.UpdateDisplayNameRequest
import com.kollekt.api.dto.UserDto
import com.kollekt.service.AccountOperations
import com.kollekt.service.CollectiveOperations
import com.kollekt.service.SocialAuthService
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/onboarding")
class OnboardingController(
    private val accountOperations: AccountOperations,
    private val collectiveOperations: CollectiveOperations,
    private val socialAuthService: SocialAuthService,
) {
    @PostMapping("/oauth/{provider}")
    fun socialLogin(
        @PathVariable provider: String,
        @RequestBody request: SocialLoginRequest,
    ): AuthResponse = socialAuthService.login(provider, request)

    @PostMapping("/refresh")
    fun refresh(
        @RequestBody request: RefreshTokenRequest,
    ): AuthResponse = accountOperations.refreshToken(request)

    @GetMapping("/me")
    fun getCurrentUser(
        @AuthenticationPrincipal jwt: Jwt,
    ): UserDto = accountOperations.getUserByName(jwt.subject)

    /**
     * Lets a freshly created social account pick its display name, before it joins a collective.
     * Returns a new token pair — the access token's subject is the member name, so the caller's
     * current token stops resolving the moment the rename lands.
     */
    @PatchMapping("/me/name")
    fun updateDisplayName(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: UpdateDisplayNameRequest,
    ): AuthResponse = accountOperations.updateDisplayName(jwt.subject, request.name)

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun logout(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody(required = false) request: LogoutRequest?,
    ) {
        accountOperations.logout(jwt, request?.refreshToken)
    }

    @PostMapping("/collectives")
    @ResponseStatus(HttpStatus.CREATED)
    fun createCollective(
        @RequestBody request: CreateCollectiveRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): CollectiveDto {
        verifyUserId(jwt, request.ownerUserId)
        return collectiveOperations.createCollective(request)
    }

    @PostMapping("/collectives/join")
    fun joinCollective(
        @RequestBody request: JoinCollectiveRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): UserDto {
        verifyUserId(jwt, request.userId)
        return collectiveOperations.joinCollective(request)
    }

    @GetMapping("/collectives/code/{userId}")
    fun getCollectiveCode(
        @PathVariable userId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): CollectiveCodeDto {
        verifyUserId(jwt, userId)
        return collectiveOperations.getCollectiveCodeForUser(userId)
    }

    private fun verifyUserId(
        jwt: Jwt,
        expectedUserId: Long,
    ) {
        val tokenUser = accountOperations.getUserByName(jwt.subject)
        if (tokenUser.id != expectedUserId) {
            throw AccessDeniedException("Token user does not match requested user")
        }
    }
}
