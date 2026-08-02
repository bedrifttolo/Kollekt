package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.domain.SocialIdentity
import com.kollekt.repository.FriendshipRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.SocialIdentityRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional

class SocialAuthServiceTest {
    private fun userProfileService(members: MemberRepository) =
        UserProfileService(members, mock<FriendshipRepository>(), mock<CurrentMemberContext>())

    @Test
    fun `verified social identity creates and permanently links a member`() {
        val members = mock<MemberRepository>()
        val identities = mock<SocialIdentityRepository>()
        val tokens = mock<TokenService>()
        whenever(identities.findByProviderAndProviderSubject("google", "provider-user-1")).thenReturn(null)
        whenever(members.findByEmail("kasper@example.com")).thenReturn(null)
        whenever(members.save(any<Member>())).thenAnswer { (it.arguments[0] as Member).copy(id = 7) }
        whenever(tokens.issueTokenPair(any())).thenReturn(TokenResult("access", "refresh", "Bearer", 3600))
        val service = SocialAuthService(members, identities, tokens, userProfileService(members), "", "")

        val response =
            service.completeLogin(
                VerifiedSocialIdentity("google", "provider-user-1", "kasper@example.com", "Kasper"),
            )

        assertEquals(7, response.user.id)
        assertEquals("kasper@example.com", response.user.email)
        val link = argumentCaptor<com.kollekt.domain.SocialIdentity>()
        verify(identities).save(link.capture())
        assertEquals(7, link.firstValue.memberId)
    }

    @Test
    fun `existing provider link reuses its member`() {
        val members = mock<MemberRepository>()
        val identities = mock<SocialIdentityRepository>()
        val tokens = mock<TokenService>()
        val member = Member(id = 4, name = "Kasper", email = "kasper@example.com")
        whenever(identities.findByProviderAndProviderSubject("apple", "apple-user")).thenReturn(
            SocialIdentity(id = 1, provider = "apple", providerSubject = "apple-user", memberId = 4),
        )
        whenever(members.findById(4)).thenReturn(Optional.of(member))
        whenever(tokens.issueTokenPair(member)).thenReturn(TokenResult("access", "refresh", "Bearer", 3600))
        val service = SocialAuthService(members, identities, tokens, userProfileService(members), "", "")

        val response = service.completeLogin(VerifiedSocialIdentity("apple", "apple-user", "kasper@example.com", null))

        assertEquals(4, response.user.id)
    }

    @Test
    fun `verified email links social identity to an existing member`() {
        val members = mock<MemberRepository>()
        val identities = mock<SocialIdentityRepository>()
        val tokens = mock<TokenService>()
        val member = Member(id = 5, name = "Kasper", email = "kasper@example.com")
        whenever(identities.findByProviderAndProviderSubject("google", "google-user")).thenReturn(null)
        whenever(members.findByEmail("kasper@example.com")).thenReturn(member)
        whenever(tokens.issueTokenPair(member)).thenReturn(TokenResult("access", "refresh", "Bearer", 3600))
        val service = SocialAuthService(members, identities, tokens, userProfileService(members), "", "")

        service.completeLogin(VerifiedSocialIdentity("google", "google-user", "kasper@example.com", "Kasper"))

        verify(identities).save(any())
    }

    @Test
    fun `unconfigured and unsupported providers are rejected before account creation`() {
        val members = mock<MemberRepository>()
        val service =
            SocialAuthService(
                members,
                mock<SocialIdentityRepository>(),
                mock<TokenService>(),
                userProfileService(members),
                "",
                "",
            )

        assertThrows(IllegalStateException::class.java) {
            service.login("google", com.kollekt.api.dto.SocialLoginRequest("token"))
        }
        assertThrows(IllegalStateException::class.java) {
            service.login("apple", com.kollekt.api.dto.SocialLoginRequest("token"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            service.login("unknown", com.kollekt.api.dto.SocialLoginRequest("token"))
        }
    }

    @Test
    fun `new social member keeps its suggested name even if it collides with another pre-join member`() {
        // Names are only required to be unique within a collective (enforced at join time), so a
        // freshly created social account no longer needs a disambiguating suffix.
        val members = mock<MemberRepository>()
        val identities = mock<SocialIdentityRepository>()
        val tokens = mock<TokenService>()
        whenever(identities.findByProviderAndProviderSubject("google", "new-user")).thenReturn(null)
        whenever(members.findByEmail("new@example.com")).thenReturn(null)
        whenever(members.save(any<Member>())).thenAnswer { (it.arguments[0] as Member).copy(id = 9) }
        whenever(tokens.issueTokenPair(any())).thenReturn(TokenResult("access", "refresh", "Bearer", 3600))
        val service = SocialAuthService(members, identities, tokens, userProfileService(members), "", "")

        val response =
            service.completeLogin(
                VerifiedSocialIdentity("google", "new-user", "new@example.com", "Kasper"),
            )

        assertEquals("Kasper", response.user.name)
    }

    @Test
    fun `orphaned provider link is rejected`() {
        val members = mock<MemberRepository>()
        val identities = mock<SocialIdentityRepository>()
        whenever(identities.findByProviderAndProviderSubject("apple", "orphan")).thenReturn(
            SocialIdentity(id = 2, provider = "apple", providerSubject = "orphan", memberId = 99),
        )
        whenever(members.findById(99)).thenReturn(Optional.empty())
        val service =
            SocialAuthService(
                members,
                identities,
                mock<TokenService>(),
                userProfileService(members),
                "",
                "",
            )

        assertThrows(IllegalArgumentException::class.java) {
            service.completeLogin(VerifiedSocialIdentity("apple", "orphan", "orphan@example.com", null))
        }
    }

    @Test
    fun `malformed configured provider tokens are rejected`() {
        val members = mock<MemberRepository>()
        val service =
            SocialAuthService(
                members,
                mock<SocialIdentityRepository>(),
                mock<TokenService>(),
                userProfileService(members),
                "google-client-id",
                "apple-client-id",
            )

        assertThrows(IllegalArgumentException::class.java) {
            service.login("google", com.kollekt.api.dto.SocialLoginRequest("not-a-jwt"))
        }
        assertThrows(Exception::class.java) {
            service.login("apple", com.kollekt.api.dto.SocialLoginRequest("not-a-jwt"))
        }
    }

    @Test
    fun `social member name falls back when provider profile has no usable name`() {
        val members = mock<MemberRepository>()
        val identities = mock<SocialIdentityRepository>()
        val tokens = mock<TokenService>()
        whenever(identities.findByProviderAndProviderSubject("apple", "private-user")).thenReturn(null)
        whenever(members.findByEmail("!!!@example.com")).thenReturn(null)
        whenever(members.save(any<Member>())).thenAnswer { (it.arguments[0] as Member).copy(id = 10) }
        whenever(tokens.issueTokenPair(any())).thenReturn(TokenResult("access", "refresh", "Bearer", 3600))
        val service = SocialAuthService(members, identities, tokens, userProfileService(members), "", "")

        val response =
            service.completeLogin(
                VerifiedSocialIdentity("apple", "private-user", "!!!@example.com", null),
            )

        assertEquals("Member", response.user.name)
    }
}
