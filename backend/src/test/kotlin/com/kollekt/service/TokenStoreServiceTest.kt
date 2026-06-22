package com.kollekt.service

import com.kollekt.domain.TokenEntry
import com.kollekt.repository.TokenEntryRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.ActiveProfiles
import java.time.Duration
import java.time.Instant

@DataJpaTest
@Import(TokenStoreService::class)
@ActiveProfiles("test")
class TokenStoreServiceTest {
    @Autowired lateinit var service: TokenStoreService

    @Autowired lateinit var tokenEntryRepository: TokenEntryRepository

    @Test
    fun `refresh token lifecycle is persisted in JPA`() {
        service.storeRefreshToken("jti-1", "Kasper", Duration.ofMinutes(30))

        assertTrue(service.isRefreshTokenActive("jti-1", "Kasper"))
        assertFalse(service.isRefreshTokenActive("jti-1", "Emma"))

        service.revokeRefreshToken("jti-1")

        assertFalse(service.isRefreshTokenActive("jti-1", "Kasper"))
    }

    @Test
    fun `access token revocation is persisted only while active`() {
        service.revokeAccessToken("jti-2", Duration.ofMinutes(5))
        service.revokeAccessToken("ignored-zero", Duration.ZERO)

        assertTrue(service.isAccessTokenRevoked("jti-2"))
        assertFalse(service.isAccessTokenRevoked("ignored-zero"))
    }

    @Test
    fun `password reset token is single use and returns its subject`() {
        service.storePasswordResetToken("hash-1", "kasper@example.com", Duration.ofMinutes(30))

        assertEquals("kasper@example.com", service.consumePasswordResetToken("hash-1"))
        // Second consume fails: the token was removed.
        assertNull(service.consumePasswordResetToken("hash-1"))
    }

    @Test
    fun `expired password reset token cannot be consumed`() {
        tokenEntryRepository.saveAndFlush(
            TokenEntry(
                jti = "hash-expired",
                subject = "kasper@example.com",
                tokenType = "PASSWORD_RESET",
                expiresAt = Instant.now().minusSeconds(60),
            ),
        )

        assertNull(service.consumePasswordResetToken("hash-expired"))
    }

    @Test
    fun `expired entries are inactive and purged on write`() {
        tokenEntryRepository.saveAndFlush(
            TokenEntry(
                jti = "expired",
                subject = "Kasper",
                tokenType = "REFRESH",
                expiresAt = Instant.now().minusSeconds(60),
            ),
        )

        assertFalse(service.isRefreshTokenActive("expired", "Kasper"))

        service.storeRefreshToken("active", "Kasper", Duration.ofMinutes(30))

        assertFalse(tokenEntryRepository.existsById("expired"))
        assertTrue(tokenEntryRepository.existsById("active"))
    }
}
