package com.kollekt.service

import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.kollekt.api.dto.AuthResponse
import com.kollekt.api.dto.SocialLoginRequest
import com.kollekt.domain.Member
import com.kollekt.domain.SocialIdentity
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.SocialIdentityRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

data class VerifiedSocialIdentity(
    val provider: String,
    val subject: String,
    val email: String,
    val displayName: String?,
)

@Service
class SocialAuthService(
    private val memberRepository: MemberRepository,
    private val socialIdentityRepository: SocialIdentityRepository,
    private val tokenService: TokenService,
    private val userProfileService: UserProfileService,
    @Value("\${app.social.google-client-ids:}") private val googleClientIds: String,
    @Value("\${app.social.apple-client-ids:}") private val appleClientIds: String,
) {
    private val googleVerifier by lazy {
        GoogleIdTokenVerifier.Builder(GoogleNetHttpTransport.newTrustedTransport(), GsonFactory.getDefaultInstance())
            .setAudience(configuredValues(googleClientIds))
            .build()
    }

    private val appleDecoder by lazy {
        NimbusJwtDecoder.withJwkSetUri("https://appleid.apple.com/auth/keys").build().apply {
            setJwtValidator(JwtValidators.createDefaultWithIssuer("https://appleid.apple.com"))
        }
    }

    @Transactional
    fun login(
        provider: String,
        request: SocialLoginRequest,
    ): AuthResponse = completeLogin(verify(provider.lowercase(), request))

    internal fun completeLogin(identity: VerifiedSocialIdentity): AuthResponse {
        val existingIdentity =
            socialIdentityRepository.findByProviderAndProviderSubject(identity.provider, identity.subject)
        val member =
            if (existingIdentity != null) {
                memberRepository.findById(existingIdentity.memberId).orElseThrow {
                    IllegalArgumentException("Social account is no longer linked to a user")
                }
            } else {
                val linkedMember = memberRepository.findByEmail(identity.email) ?: createMember(identity)
                socialIdentityRepository.save(
                    SocialIdentity(
                        provider = identity.provider,
                        providerSubject = identity.subject,
                        memberId = linkedMember.id,
                    ),
                )
                linkedMember
            }

        val token = tokenService.issueTokenPair(member)
        return AuthResponse(
            accessToken = token.accessToken,
            refreshToken = token.refreshToken,
            tokenType = token.tokenType,
            expiresIn = token.expiresIn,
            user = userProfileService.toUserDto(member),
        )
    }

    private fun verify(
        provider: String,
        request: SocialLoginRequest,
    ): VerifiedSocialIdentity =
        when (provider) {
            "google" -> verifyGoogle(request)
            "apple" -> verifyApple(request)
            else -> throw IllegalArgumentException("Unsupported social provider")
        }

    private fun verifyGoogle(request: SocialLoginRequest): VerifiedSocialIdentity {
        if (configuredValues(googleClientIds).isEmpty()) {
            throw IllegalStateException("Google sign-in is not configured")
        }
        val payload =
            googleVerifier.verify(request.idToken)?.payload
                ?: throw IllegalArgumentException("Invalid Google identity token")
        if (payload.emailVerified != true || payload.email.isNullOrBlank()) {
            throw IllegalArgumentException("Google email is not verified")
        }
        return VerifiedSocialIdentity(
            "google",
            payload.subject,
            payload.email.lowercase(),
            request.displayName ?: payload["name"] as? String,
        )
    }

    private fun verifyApple(request: SocialLoginRequest): VerifiedSocialIdentity {
        val audiences = configuredValues(appleClientIds)
        if (audiences.isEmpty()) {
            throw IllegalStateException("Apple sign-in is not configured")
        }
        val jwt = appleDecoder.decode(request.idToken)
        if (jwt.audience.none(audiences::contains)) throw IllegalArgumentException("Invalid Apple token audience")
        if (!request.nonce.isNullOrBlank() && jwt.getClaimAsString("nonce") != request.nonce) {
            throw IllegalArgumentException("Invalid Apple token nonce")
        }
        val email = jwt.getClaimAsString("email")?.lowercase() ?: throw IllegalArgumentException("Apple did not provide an email")
        val emailVerified = jwt.claims["email_verified"]?.toString()?.toBooleanStrictOrNull() ?: false
        if (!emailVerified) throw IllegalArgumentException("Apple email is not verified")
        return VerifiedSocialIdentity("apple", jwt.subject, email, request.displayName)
    }

    private fun createMember(identity: VerifiedSocialIdentity): Member {
        val suggested = identity.displayName?.trim().orEmpty().ifBlank { identity.email.substringBefore('@') }
        val name = suggested.replace(Regex("[^\\p{L}\\p{N}_ -]"), "").take(40).ifBlank { "Member" }
        // No uniqueness check: identity is keyed by id, not name, and names are only required to
        // be unique within a collective (enforced at join time), not before joining one.
        return memberRepository.save(Member(name = name, email = identity.email))
    }

    private fun configuredValues(value: String) = value.split(',').map(String::trim).filter(String::isNotEmpty)
}
