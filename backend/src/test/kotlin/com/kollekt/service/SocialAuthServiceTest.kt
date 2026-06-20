package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.domain.SocialIdentity
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
    @Test
    fun `verified social identity creates and permanently links a member`() {
        val members = mock<MemberRepository>()
        val identities = mock<SocialIdentityRepository>()
        val tokens = mock<TokenService>()
        whenever(identities.findByProviderAndProviderSubject("google", "provider-user-1")).thenReturn(null)
        whenever(members.findByEmail("kasper@example.com")).thenReturn(null)
        whenever(members.findByName("Kasper")).thenReturn(null)
        whenever(members.save(any<Member>())).thenAnswer { (it.arguments[0] as Member).copy(id = 7) }
        whenever(tokens.issueTokenPair(any())).thenReturn(TokenResult("access", "refresh", "Bearer", 3600))
        val service = SocialAuthService(members, identities, tokens, UserProfileService(members), "", "")

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
        val service = SocialAuthService(members, identities, tokens, UserProfileService(members), "", "")

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
        val service = SocialAuthService(members, identities, tokens, UserProfileService(members), "", "")

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
                UserProfileService(members),
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
    fun `new social member receives a unique sanitized name`() {
        val members = mock<MemberRepository>()
        val identities = mock<SocialIdentityRepository>()
        val tokens = mock<TokenService>()
        whenever(identities.findByProviderAndProviderSubject("google", "new-user")).thenReturn(null)
        whenever(members.findByEmail("new@example.com")).thenReturn(null)
        whenever(members.findByName("Kasper")).thenReturn(Member(id = 1, name = "Kasper", email = "other@example.com"))
        whenever(members.findByName("Kasper 2")).thenReturn(null)
        whenever(members.save(any<Member>())).thenAnswer { (it.arguments[0] as Member).copy(id = 9) }
        whenever(tokens.issueTokenPair(any())).thenReturn(TokenResult("access", "refresh", "Bearer", 3600))
        val service = SocialAuthService(members, identities, tokens, UserProfileService(members), "", "")

        val response =
            service.completeLogin(
                VerifiedSocialIdentity("google", "new-user", "new@example.com", "Kasper"),
            )

        assertEquals("Kasper 2", response.user.name)
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
                UserProfileService(members),
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
                UserProfileService(members),
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
        whenever(members.findByName("Member")).thenReturn(null)
        whenever(members.save(any<Member>())).thenAnswer { (it.arguments[0] as Member).copy(id = 10) }
        whenever(tokens.issueTokenPair(any())).thenReturn(TokenResult("access", "refresh", "Bearer", 3600))
        val service = SocialAuthService(members, identities, tokens, UserProfileService(members), "", "")

        val response =
            service.completeLogin(
                VerifiedSocialIdentity("apple", "private-user", "!!!@example.com", null),
            )

        assertEquals("Member", response.user.name)
    }
}
