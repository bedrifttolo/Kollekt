package com.kollekt.service

import com.kollekt.domain.TokenEntry
import com.kollekt.repository.TokenEntryRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

data class GoogleOAuthState(
    val memberId: Long,
    val returnUrl: String,
)

@Service
class GoogleOAuthStateService(
    private val tokenEntryRepository: TokenEntryRepository,
) {
    @Transactional
    fun issueState(
        memberId: Long,
        returnUrl: String,
    ): String {
        require(!returnUrl.contains('\n'))
        val state = UUID.randomUUID().toString()
        tokenEntryRepository.deleteByExpiresAtBefore(Instant.now())
        tokenEntryRepository.save(
            TokenEntry(
                jti = state,
                subject = "$memberId\n$returnUrl",
                tokenType = GOOGLE_OAUTH_STATE,
                expiresAt = Instant.now().plus(10, ChronoUnit.MINUTES),
            ),
        )
        return state
    }

    @Transactional
    fun consumeState(state: String): GoogleOAuthState {
        val entry =
            tokenEntryRepository.findByJtiAndTokenTypeAndExpiresAtAfter(
                state,
                GOOGLE_OAUTH_STATE,
                Instant.now(),
            ) ?: throw IllegalArgumentException("Invalid or expired OAuth state")
        tokenEntryRepository.delete(entry)
        val parts = entry.subject.split('\n', limit = 2)
        require(parts.size == 2) { "Invalid OAuth state" }
        val memberId = parts[0].toLongOrNull() ?: throw IllegalArgumentException("Invalid OAuth state")
        return GoogleOAuthState(memberId, parts[1])
    }

    private companion object {
        const val GOOGLE_OAUTH_STATE = "GOOGLE_OAUTH_STATE"
    }
}
