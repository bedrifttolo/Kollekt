package com.kollekt.service

import com.kollekt.api.dto.AuthResponse
import com.kollekt.api.dto.RefreshTokenRequest
import com.kollekt.api.dto.UserDto
import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Account lifecycle for a social-login-only app. Sign-up and sign-in both go through
 * [SocialAuthService]; what remains here is everything that happens once an identity exists —
 * reading the current user, rotating tokens, and revoking them.
 */
@Service
class AccountOperations(
    private val memberRepository: MemberRepository,
    private val tokenService: TokenService,
    private val userProfileService: UserProfileService,
    private val currentMemberContext: CurrentMemberContext,
) {
    fun getCurrentUser(jwt: Jwt): UserDto = userProfileService.toUserDto(currentMemberContext.current(jwt))

    /**
     * Sets the member's display name, but only before they belong to a collective.
     *
     * Apple and Google cannot be relied on for a usable name — Apple returns one only on the very
     * first authorization, and Private Relay addresses yield a name like "a1b2c3d4e5" — so a fresh
     * social account gets an auto-generated one it must be able to correct.
     *
     * The `collectiveCode == null` guard is what makes this safe. Member *name* is the de-facto
     * foreign key across the app (tasks, expenses, chat messages, settlements all store it as a
     * string), so renaming an established member would orphan their history. Before joining a
     * collective, none of those rows can exist.
     *
     * Names are only unique *within* a collective (enforced at join time, see
     * [CollectiveOperations.joinCollective]), so there's nothing to check here — pre-join members
     * are free to share a display name with anyone, anywhere, until they actually join a household.
     */
    @Transactional
    fun updateDisplayName(
        jwt: Jwt,
        requestedName: String,
    ): AuthResponse {
        val name = requestedName.trim()
        if (name.isBlank()) throw IllegalArgumentException("Name is required")
        if (name.length > MAX_NAME_LENGTH) throw IllegalArgumentException("Name must be at most $MAX_NAME_LENGTH characters")

        val member = currentMemberContext.current(jwt)

        if (member.collectiveCode != null) {
            throw IllegalArgumentException("Name can only be changed before joining a collective")
        }

        return toAuthResponse(memberRepository.save(member.copy(name = name)))
    }

    fun refreshToken(request: RefreshTokenRequest): AuthResponse {
        val refreshResult = tokenService.rotateRefreshToken(request.refreshToken)
        val id =
            refreshResult.subject.toLongOrNull()
                ?: throw IllegalArgumentException("Invalid refresh token")
        val user =
            memberRepository.findById(id).orElseThrow {
                IllegalArgumentException("User '${refreshResult.subject}' not found")
            }
        return toAuthResponse(user)
    }

    fun logout(
        accessTokenJwt: Jwt,
        refreshToken: String?,
    ) {
        tokenService.revokeAccessToken(accessTokenJwt)
        if (!refreshToken.isNullOrBlank()) {
            tokenService.revokeRefreshToken(refreshToken)
        }
    }

    private fun toAuthResponse(member: Member): AuthResponse {
        val token = tokenService.issueTokenPair(member)
        return AuthResponse(
            accessToken = token.accessToken,
            refreshToken = token.refreshToken,
            tokenType = token.tokenType,
            expiresIn = token.expiresIn,
            user = userProfileService.toUserDto(member),
        )
    }

    private companion object {
        /** Same cap SocialAuthService.createMember applies to auto-generated names. The column
         *  itself is wider, but names are shown in avatars, chat and leaderboards throughout. */
        const val MAX_NAME_LENGTH = 40
    }
}
