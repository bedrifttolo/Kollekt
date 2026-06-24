package com.kollekt.service

import com.kollekt.domain.Invitation
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.check
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify

class InvitationMailerTest {
    @Test
    fun `sendInvitation emails the invitee with the join code`() {
        val emailSender = mock<EmailSender>()
        val mailer = InvitationMailer(emailSender, "http://localhost:5173/")

        mailer.sendInvitation(
            Invitation(id = 1, email = "kasper@example.com", collectiveCode = "ABC123", invitedBy = "Emma"),
        )

        verify(emailSender).send(
            eq("kasper@example.com"),
            any(),
            check { assertTrue(it.contains("ABC123")) },
        )
    }
}
