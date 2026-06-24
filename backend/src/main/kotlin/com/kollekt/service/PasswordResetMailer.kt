package com.kollekt.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * Delivers password-reset links. Delegates delivery to [EmailSender]; when mail is not configured
 * (e.g. local development) the link is logged so the flow stays usable without SMTP credentials.
 */
@Component
class PasswordResetMailer(
    private val emailSender: EmailSender,
    @Value("\${app.frontend-url}") private val frontendUrl: String,
) {
    private val log = LoggerFactory.getLogger(PasswordResetMailer::class.java)

    fun sendResetLink(
        email: String,
        rawToken: String,
    ) {
        val link = "${frontendUrl.trimEnd('/')}/reset-password?token=$rawToken"
        log.info("Password reset link for {}: {}", email, link)
        emailSender.send(
            to = email,
            subject = "Reset your Kollekt password",
            body =
                buildString {
                    appendLine("We received a request to reset your Kollekt password.")
                    appendLine()
                    appendLine("Reset it here: $link")
                    appendLine()
                    appendLine("If you didn't request this, you can safely ignore this email.")
                },
        )
    }
}
