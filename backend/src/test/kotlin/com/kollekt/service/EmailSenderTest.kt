package com.kollekt.service

import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.ObjectProvider
import org.springframework.mail.SimpleMailMessage
import org.springframework.mail.javamail.JavaMailSender

class EmailSenderTest {
    private fun provider(sender: JavaMailSender?): ObjectProvider<JavaMailSender> {
        val provider = mock<ObjectProvider<JavaMailSender>>()
        whenever(provider.ifAvailable).thenReturn(sender)
        return provider
    }

    @Test
    fun `does not send when mail is disabled`() {
        val sender = mock<JavaMailSender>()
        val emailSender = EmailSender(provider(sender), enabled = false, from = "Kollekt <no-reply@kollekt.no>")

        emailSender.send("a@example.com", "Subject", "Body")

        verify(sender, never()).send(any<SimpleMailMessage>())
    }

    @Test
    fun `does not send when no transport is available`() {
        val emailSender = EmailSender(provider(null), enabled = true, from = "Kollekt <no-reply@kollekt.no>")

        assertDoesNotThrow { emailSender.send("a@example.com", "Subject", "Body") }
    }

    @Test
    fun `sends through the transport when enabled and configured`() {
        val sender = mock<JavaMailSender>()
        val emailSender = EmailSender(provider(sender), enabled = true, from = "Kollekt <no-reply@kollekt.no>")

        emailSender.send("a@example.com", "Subject", "Body")

        verify(sender).send(any<SimpleMailMessage>())
    }

    @Test
    fun `swallows transport failures so the caller flow is never broken`() {
        val sender = mock<JavaMailSender>()
        doThrow(RuntimeException("smtp down")).whenever(sender).send(any<SimpleMailMessage>())
        val emailSender = EmailSender(provider(sender), enabled = true, from = "Kollekt <no-reply@kollekt.no>")

        assertDoesNotThrow { emailSender.send("a@example.com", "Subject", "Body") }
    }
}
