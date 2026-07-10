package com.kollekt.service

import com.kollekt.domain.TokenEntry
import com.kollekt.repository.TokenEntryRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

@Service
class TokenStoreService(
    private val tokenEntryRepository: TokenEntryRepository,
) {
    private data class CachedRevocation(
        val revoked: Boolean,
        val expiresAtNanos: Long,
    )

    private val accessRevocationCache = ConcurrentHashMap<String, CachedRevocation>()

    @Transactional
    fun storeRefreshToken(
        jti: String,
        subject: String,
        ttl: Duration,
    ) {
        purgeExpired()
        tokenEntryRepository.save(
            TokenEntry(
                jti = jti,
                subject = subject,
                tokenType = REFRESH,
                expiresAt = Instant.now().plus(ttl),
            ),
        )
    }

    fun isRefreshTokenActive(
        jti: String,
        subject: String,
    ): Boolean =
        tokenEntryRepository.existsByJtiAndSubjectAndTokenTypeAndExpiresAtAfter(
            jti,
            subject,
            REFRESH,
            Instant.now(),
        )

    @Transactional
    fun revokeRefreshToken(jti: String) {
        tokenEntryRepository.deleteByJtiAndTokenType(jti, REFRESH)
    }

    @Transactional
    fun revokeAccessToken(
        jti: String,
        ttl: Duration,
    ) {
        if (ttl.isNegative || ttl.isZero) return
        purgeExpired()
        tokenEntryRepository.save(
            TokenEntry(
                jti = jti,
                subject = "",
                tokenType = REVOKED_ACCESS,
                expiresAt = Instant.now().plus(ttl),
            ),
        )
        accessRevocationCache[jti] =
            CachedRevocation(
                revoked = true,
                expiresAtNanos = System.nanoTime() + ttl.coerceAtMost(MAX_REVOKED_CACHE_TTL).toNanos(),
            )
    }

    fun isAccessTokenRevoked(jti: String): Boolean {
        val nowNanos = System.nanoTime()
        accessRevocationCache[jti]?.takeIf { it.expiresAtNanos > nowNanos }?.let { return it.revoked }

        val revoked =
            tokenEntryRepository.existsByJtiAndTokenTypeAndExpiresAtAfter(
                jti,
                REVOKED_ACCESS,
                Instant.now(),
            )
        accessRevocationCache[jti] =
            CachedRevocation(
                revoked = revoked,
                expiresAtNanos = nowNanos + ACCESS_REVOCATION_CACHE_TTL.toNanos(),
            )
        if (accessRevocationCache.size > MAX_ACCESS_CACHE_ENTRIES) {
            accessRevocationCache.entries.removeIf { it.value.expiresAtNanos <= nowNanos }
        }
        return revoked
    }

    @Transactional
    fun storePasswordResetToken(
        hashedToken: String,
        subject: String,
        ttl: Duration,
    ) {
        purgeExpired()
        tokenEntryRepository.save(
            TokenEntry(
                jti = hashedToken,
                subject = subject,
                tokenType = PASSWORD_RESET,
                expiresAt = Instant.now().plus(ttl),
            ),
        )
    }

    /** Returns the token subject and removes the token (single use), or null if it is missing or expired. */
    @Transactional
    fun consumePasswordResetToken(hashedToken: String): String? {
        val entry =
            tokenEntryRepository.findByJtiAndTokenTypeAndExpiresAtAfter(
                hashedToken,
                PASSWORD_RESET,
                Instant.now(),
            ) ?: return null
        tokenEntryRepository.deleteByJtiAndTokenType(hashedToken, PASSWORD_RESET)
        return entry.subject
    }

    private fun purgeExpired() {
        tokenEntryRepository.deleteByExpiresAtBefore(Instant.now())
    }

    private companion object {
        const val REFRESH = "REFRESH"
        const val REVOKED_ACCESS = "REVOKED_ACCESS"
        const val PASSWORD_RESET = "PASSWORD_RESET"
        const val MAX_ACCESS_CACHE_ENTRIES = 10_000
        val ACCESS_REVOCATION_CACHE_TTL: Duration = Duration.ofSeconds(30)
        val MAX_REVOKED_CACHE_TTL: Duration = Duration.ofHours(1)
    }
}
