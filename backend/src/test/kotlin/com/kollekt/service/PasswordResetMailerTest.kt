package com.kollekt.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify

class PasswordResetMailerTest {
    @Test
    fun `sendResetLink builds a reset link and delegates to the email sender`() {
        val emailSender = mock<EmailSender>()
        val mailer = PasswordResetMailer(emailSender, "http://localhost:5173/")

        assertDoesNotThrow {
            mailer.sendResetLink("kasper@example.com", "raw-token-123")
        }

        verify(emailSender).send(eq("kasper@example.com"), any(), any())
    }
}
