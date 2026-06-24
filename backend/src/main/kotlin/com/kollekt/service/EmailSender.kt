package com.kollekt.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.mail.SimpleMailMessage
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.stereotype.Component

/**
 * Sends transactional emails (password resets, collective invitations) through the configured
 * SMTP provider (Resend). When mail is disabled or no SMTP transport is configured — e.g. in
 * local development and tests — the message is logged instead, so the surrounding flow never
 * fails because mail credentials are missing.
 */
@Component
class EmailSender(
    private val mailSenderProvider: ObjectProvider<JavaMailSender>,
    @Value("\${app.mail.enabled:false}") private val enabled: Boolean,
    @Value("\${app.mail.from:}") private val from: String,
) {
    private val log = LoggerFactory.getLogger(EmailSender::class.java)

    fun send(
        to: String,
        subject: String,
        body: String,
    ) {
        val mailSender = mailSenderProvider.ifAvailable
        if (!enabled || mailSender == null || from.isBlank()) {
            log.info("Email not sent (mail disabled or unconfigured). To: {}, subject: {}", to, subject)
            return
        }
        try {
            val message = SimpleMailMessage()
            message.from = from
            message.setTo(to)
            message.subject = subject
            message.text = body
            mailSender.send(message)
        } catch (ex: Exception) {
            // Never break the caller's flow because email delivery failed.
            log.warn("Failed to send email to {} (subject: {})", to, subject, ex)
        }
    }
}
