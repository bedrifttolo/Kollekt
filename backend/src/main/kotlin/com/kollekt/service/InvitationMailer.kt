package com.kollekt.service

import com.kollekt.domain.Invitation
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * Emails a household invitation to the invited address. Delegates delivery to [EmailSender], so
 * when mail is not configured the invitation still exists (DB + realtime) and the link is logged.
 */
@Component
class InvitationMailer(
    private val emailSender: EmailSender,
    @Value("\${app.frontend-url}") private val frontendUrl: String,
) {
    private val log = LoggerFactory.getLogger(InvitationMailer::class.java)

    fun sendInvitation(invitation: Invitation) {
        val link = frontendUrl.trimEnd('/')
        log.info("Invitation for {} to collective {}", invitation.email, invitation.collectiveCode)
        emailSender.send(
            to = invitation.email,
            subject = "You've been invited to a Kollekt household",
            body =
                buildString {
                    appendLine("${invitation.invitedBy} has invited you to join their household on Kollekt.")
                    appendLine()
                    appendLine("Join code: ${invitation.collectiveCode}")
                    appendLine()
                    appendLine("Open Kollekt to accept the invitation: $link")
                },
        )
    }
}
