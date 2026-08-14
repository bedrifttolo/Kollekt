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
        appendLine(builder, "ORGANIZER;CN=${paramValue(event.organizer)}:mailto:noreply@kollekt.app")
        appendLine(builder, "END:VEVENT")
    }

    private fun escape(value: String): String =
        value
            .replace("\\", "\\\\")
            .replace(";", "\\;")
            .replace(",", "\\,")
            .replace("\n", "\\n")

    /**
     * A *parameter* value (`CN=…`), which follows different rules from a property value: RFC 5545
     * gives no backslash escapes for parameters, so the old `escape()` here emitted `CN=Ada\, Lovelace`
     * — not valid, and enough for a strict parser to reject the event. `,`, `;` and `:` are legal
     * only inside a quoted string, and a `"` cannot be represented at all, so it is dropped.
     */
    private fun paramValue(value: String): String {
        val cleaned = value.replace("\"", "").replace("\n", " ")
        return if (cleaned.any { it == ',' || it == ';' || it == ':' }) "\"$cleaned\"" else cleaned
    }

    /**
     * Appends a content line with CRLF endings, folding lines longer than 75 octets (RFC 5545).
     *
     * Octets, not characters: this used to cut at 75 *chars*, so a Norwegian title full of æ/ø/å
     * (two bytes each in UTF-8) produced lines up to 150 bytes long. Splitting is still done on
     * whole characters, since a fold in the middle of a multi-byte sequence would corrupt it.
     */
    private fun appendLine(
        builder: StringBuilder,
        line: String,
    ) {
        var index = 0
        var first = true
        while (index < line.length) {
            val limit = if (first) 75 else 74
            var octets = 0
            var end = index
            while (end < line.length) {
                val width = utf8Width(line, end)
                if (octets + width > limit) break
                octets += width
                end += charCount(line, end)
            }
            // A single character wider than the limit can never fit; emit it anyway rather than
            // spinning forever on a zero-length chunk.
            if (end == index) end = index + charCount(line, index)
            if (!first) builder.append(' ')
            builder.append(line, index, end).append("\r\n")
            index = end
            first = false
        }
    }

    /** Chars consumed by the code point at [at] — 2 for a surrogate pair (emoji), 1 otherwise. */
    private fun charCount(
        line: String,
        at: Int,
    ): Int = if (Character.isHighSurrogate(line[at]) && at + 1 < line.length) 2 else 1

    /** UTF-8 byte width of the code point at [at]. */
    private fun utf8Width(
        line: String,
        at: Int,
    ): Int {
        val code = line.codePointAt(at)
        return when {
            code < 0x80 -> 1
            code < 0x800 -> 2
            code < 0x10000 -> 3
            else -> 4
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
