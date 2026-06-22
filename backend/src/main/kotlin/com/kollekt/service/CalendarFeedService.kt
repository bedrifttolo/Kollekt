package com.kollekt.service

import com.kollekt.domain.CalendarEvent
import com.kollekt.repository.EventRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Builds a read-only iCalendar (.ics) subscription feed for a collective so any
 * calendar app (Apple, Google, Android, Outlook) can subscribe to the household calendar.
 *
 * The feed URL is a capability URL: `/calendar-feed/{collectiveCode}/{signature}.ics`.
 * The signature is an HMAC of the collective code, so the URL is unguessable and needs
 * no login (calendar apps fetch it anonymously) while staying scoped to one collective.
 */
@Service
class CalendarFeedService(
    private val eventRepository: EventRepository,
    private val collectiveAccessService: CollectiveAccessService,
    @Value("\${app.security.jwt-secret}") private val signingSecret: String,
) {
    private val localFormat = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss")
    private val utcFormat = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")

    /** Relative path (under the API base) of the calling member's collective feed. */
    fun feedPathForMember(memberName: String): String {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        return "/calendar-feed/$collectiveCode/${sign(collectiveCode)}.ics"
    }

    /** Validates the capability URL and renders the feed, or throws if the signature is wrong. */
    fun buildFeed(
        collectiveCode: String,
        token: String,
    ): String {
        val signature = token.removeSuffix(".ics")
        require(constantTimeEquals(signature, sign(collectiveCode))) { "Invalid calendar feed token" }
        return buildIcs(collectiveCode)
    }

    private fun sign(collectiveCode: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(signingSecret.toByteArray(), "HmacSHA256"))
        val raw = mac.doFinal("calendar-feed:$collectiveCode".toByteArray())
        return raw.joinToString("") { "%02x".format(it) }.substring(0, 32)
    }

    private fun buildIcs(collectiveCode: String): String {
        val stamp = LocalDateTime.now(ZoneOffset.UTC).format(utcFormat)
        val events = eventRepository.findAllByCollectiveCode(collectiveCode).sortedBy { it.date }
        val builder = StringBuilder()
        appendLine(builder, "BEGIN:VCALENDAR")
        appendLine(builder, "VERSION:2.0")
        appendLine(builder, "PRODID:-//Kollekt//Calendar//EN")
        appendLine(builder, "CALSCALE:GREGORIAN")
        appendLine(builder, "METHOD:PUBLISH")
        appendLine(builder, "X-WR-CALNAME:Kollekt")
        events.forEach { appendEvent(builder, it, stamp) }
        appendLine(builder, "END:VCALENDAR")
        return builder.toString()
    }

    private fun appendEvent(
        builder: StringBuilder,
        event: CalendarEvent,
        stamp: String,
    ) {
        val start = LocalDateTime.of(event.date, event.time)
        val end = event.endTime?.let { LocalDateTime.of(event.date, it) } ?: start.plusHours(1)
        appendLine(builder, "BEGIN:VEVENT")
        appendLine(builder, "UID:kollekt-${event.id}@kollekt.app")
        appendLine(builder, "DTSTAMP:$stamp")
        appendLine(builder, "DTSTART:${start.format(localFormat)}")
        appendLine(builder, "DTEND:${end.format(localFormat)}")
        appendLine(builder, "SUMMARY:${escape(event.title)}")
        event.description?.takeIf { it.isNotBlank() }?.let {
            appendLine(builder, "DESCRIPTION:${escape(it)}")
        }
        appendLine(builder, "ORGANIZER;CN=${escape(event.organizer)}:mailto:noreply@kollekt.app")
        appendLine(builder, "END:VEVENT")
    }

    private fun escape(value: String): String =
        value
            .replace("\\", "\\\\")
            .replace(";", "\\;")
            .replace(",", "\\,")
            .replace("\n", "\\n")

    /** Appends a content line with CRLF endings, folding lines longer than 75 octets (RFC 5545). */
    private fun appendLine(
        builder: StringBuilder,
        line: String,
    ) {
        var remaining = line
        var first = true
        while (remaining.isNotEmpty()) {
            val limit = if (first) 75 else 74
            val chunk = remaining.take(limit)
            if (!first) builder.append(' ')
            builder.append(chunk).append("\r\n")
            remaining = remaining.drop(limit)
            first = false
        }
    }

    private fun constantTimeEquals(
        a: String,
        b: String,
    ): Boolean {
        if (a.length != b.length) return false
        var result = 0
        for (i in a.indices) result = result or (a[i].code xor b[i].code)
        return result == 0
    }
}
