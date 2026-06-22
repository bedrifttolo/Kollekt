package com.kollekt.service

import com.kollekt.repository.MemberRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Duration
import java.util.Base64

@Service
class PasswordResetService(
    private val memberRepository: MemberRepository,
    private val passwordEncoder: PasswordEncoder,
    private val tokenStoreService: TokenStoreService,
    private val mailer: PasswordResetMailer,
    @Value("\${app.password-reset.token-validity-seconds}") private val tokenValiditySeconds: Long,
) {
    private val secureRandom = SecureRandom()

    /**
     * Always succeeds regardless of whether the email exists, to avoid account enumeration.
     * When the email matches a member, a single-use, time-limited token is stored (hashed)
     * and a reset link is sent.
     */
    @Transactional
    fun requestReset(email: String) {
        val normalized = email.trim().lowercase()
        if (normalized.isBlank()) return
        val member = memberRepository.findByEmail(normalized) ?: return

        val rawToken = generateToken()
        tokenStoreService.storePasswordResetToken(
            hash(rawToken),
            member.email,
            Duration.ofSeconds(tokenValiditySeconds),
        )
        mailer.sendResetLink(member.email, rawToken)
    }

    @Transactional
    fun confirmReset(
        token: String,
        newPassword: String,
    ) {
        if (newPassword.length < 8) {
            throw IllegalArgumentException("Password must be at least 8 characters")
        }

        val email =
            tokenStoreService.consumePasswordResetToken(hash(token.trim()))
                ?: throw IllegalArgumentException("This reset link is invalid or has expired")

        val member =
            memberRepository.findByEmail(email)
                ?: throw IllegalArgumentException("This reset link is invalid or has expired")

        memberRepository.save(member.copy(passwordHash = passwordEncoder.encode(newPassword)))
    }

    private fun generateToken(): String {
        val bytes = ByteArray(32)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun hash(token: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(token.toByteArray())
            .joinToString("") { "%02x".format(it) }
}
