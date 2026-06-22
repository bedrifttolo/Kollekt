package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.crypto.password.PasswordEncoder
import java.security.MessageDigest
import java.time.Duration

class PasswordResetServiceTest {
    private fun sha256(value: String): String =
        MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }

    @Test
    fun `requestReset stores a hashed single-use token and emails a link for a known account`() {
        val members = mock<MemberRepository>()
        val tokens = mock<TokenStoreService>()
        val mailer = mock<PasswordResetMailer>()
        whenever(members.findByEmail("kasper@example.com")).thenReturn(
            Member(name = "Kasper", email = "kasper@example.com", passwordHash = "old"),
        )
        val service = PasswordResetService(members, mock(), tokens, mailer, 3600)

        service.requestReset("  Kasper@Example.com ")

        val storedToken = argumentCaptor<String>()
        val storedSubject = argumentCaptor<String>()
        verify(tokens).storePasswordResetToken(storedToken.capture(), storedSubject.capture(), any<Duration>())
        val sentToken = argumentCaptor<String>()
        verify(mailer).sendResetLink(org.mockito.kotlin.eq("kasper@example.com"), sentToken.capture())

        assertEquals("kasper@example.com", storedSubject.firstValue)
        // The raw token is emailed; only its hash is persisted.
        assertNotEquals(sentToken.firstValue, storedToken.firstValue)
        assertEquals(sha256(sentToken.firstValue), storedToken.firstValue)
    }

    @Test
    fun `requestReset is silent for an unknown account to avoid enumeration`() {
        val members = mock<MemberRepository>()
        val tokens = mock<TokenStoreService>()
        val mailer = mock<PasswordResetMailer>()
        whenever(members.findByEmail(any())).thenReturn(null)
        val service = PasswordResetService(members, mock(), tokens, mailer, 3600)

        service.requestReset("ghost@example.com")

        verify(tokens, never()).storePasswordResetToken(any(), any(), any())
        verify(mailer, never()).sendResetLink(any(), any())
    }

    @Test
    fun `requestReset ignores a blank email`() {
        val members = mock<MemberRepository>()
        val tokens = mock<TokenStoreService>()
        val mailer = mock<PasswordResetMailer>()
        val service = PasswordResetService(members, mock(), tokens, mailer, 3600)

        service.requestReset("   ")

        verify(members, never()).findByEmail(any())
        verify(tokens, never()).storePasswordResetToken(any(), any(), any())
    }

    @Test
    fun `confirmReset rejects when the account no longer exists`() {
        val members = mock<MemberRepository>()
        val tokens = mock<TokenStoreService>()
        whenever(tokens.consumePasswordResetToken(any())).thenReturn("ghost@example.com")
        whenever(members.findByEmail("ghost@example.com")).thenReturn(null)
        val service = PasswordResetService(members, mock(), tokens, mock(), 3600)

        assertThrows(IllegalArgumentException::class.java) {
            service.confirmReset("raw-token", "brand-new-pass")
        }
        verify(members, never()).save(any())
    }

    @Test
    fun `confirmReset sets the new password when the token is valid`() {
        val members = mock<MemberRepository>()
        val tokens = mock<TokenStoreService>()
        val encoder = mock<PasswordEncoder>()
        val member = Member(name = "Kasper", email = "kasper@example.com", passwordHash = "old")
        whenever(tokens.consumePasswordResetToken(any())).thenReturn("kasper@example.com")
        whenever(members.findByEmail("kasper@example.com")).thenReturn(member)
        whenever(encoder.encode("brand-new-pass")).thenReturn("encoded")
        val service = PasswordResetService(members, encoder, tokens, mock(), 3600)

        service.confirmReset("raw-token", "brand-new-pass")

        val saved = argumentCaptor<Member>()
        verify(members).save(saved.capture())
        assertEquals("encoded", saved.firstValue.passwordHash)
    }

    @Test
    fun `confirmReset rejects an invalid or expired token`() {
        val members = mock<MemberRepository>()
        val tokens = mock<TokenStoreService>()
        whenever(tokens.consumePasswordResetToken(any())).thenReturn(null)
        val service = PasswordResetService(members, mock(), tokens, mock(), 3600)

        assertThrows(IllegalArgumentException::class.java) {
            service.confirmReset("bad-token", "brand-new-pass")
        }
        verify(members, never()).save(any())
    }

    @Test
    fun `confirmReset rejects a too-short password before consuming the token`() {
        val tokens = mock<TokenStoreService>()
        val service = PasswordResetService(mock(), mock(), tokens, mock(), 3600)

        assertThrows(IllegalArgumentException::class.java) {
            service.confirmReset("raw-token", "short")
        }
        verify(tokens, never()).consumePasswordResetToken(any())
    }
}
