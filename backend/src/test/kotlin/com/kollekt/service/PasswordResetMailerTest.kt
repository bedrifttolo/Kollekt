package com.kollekt.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow

class PasswordResetMailerTest {
    @Test
    fun `sendResetLink builds a reset link without throwing`() {
        val mailer = PasswordResetMailer("http://localhost:5173/")

        assertDoesNotThrow {
            mailer.sendResetLink("kasper@example.com", "raw-token-123")
        }
    }
}
