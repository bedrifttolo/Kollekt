package com.kollekt.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * Delivers password-reset links. No SMTP transport is wired yet, so links are logged
 * to make the flow usable in development. To enable real email delivery, add
 * spring-boot-starter-mail + spring.mail.* configuration and send from [sendResetLink].
 */
@Component
class PasswordResetMailer(
    @Value("\${app.frontend-url}") private val frontendUrl: String,
) {
    private val log = LoggerFactory.getLogger(PasswordResetMailer::class.java)

    fun sendResetLink(
        email: String,
        rawToken: String,
    ) {
        val link = "${frontendUrl.trimEnd('/')}/reset-password?token=$rawToken"
        log.info("Password reset link for {}: {}", email, link)
    }
}
