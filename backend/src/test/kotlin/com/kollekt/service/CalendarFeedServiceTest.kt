package com.kollekt.service

import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.EventType
import com.kollekt.repository.EventRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDate
import java.time.LocalTime

class CalendarFeedServiceTest {
    private lateinit var eventRepository: EventRepository
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var service: CalendarFeedService

    @BeforeEach
    fun setUp() {
        eventRepository = mock()
        collectiveAccessService = mock()
        service = CalendarFeedService(eventRepository, collectiveAccessService, "test-signing-secret")
    }

    @Test
    fun `feed path contains collective code and stable signed token`() {
        whenever(collectiveAccessService.requireCollectiveCodeByMemberName("Kasper")).thenReturn("ABC123")

        val first = service.feedPathForMember("Kasper")
        val second = service.feedPathForMember("Kasper")

        assertEquals(first, second)
        assertTrue(first.matches(Regex("/calendar-feed/ABC123/[0-9a-f]{32}\\.ics")))
        verify(collectiveAccessService, org.mockito.kotlin.times(2)).requireCollectiveCodeByMemberName("Kasper")
    }

    @Test
    fun `valid token builds sorted escaped calendar events with explicit and default end times`() {
        whenever(collectiveAccessService.requireCollectiveCodeByMemberName("Kasper")).thenReturn("ABC123")
        val path = service.feedPathForMember("Kasper")
        val token = path.substringAfterLast('/')
        whenever(eventRepository.findAllByCollectiveCode("ABC123"))
            .thenReturn(
                listOf(
                    event(
                        id = 2,
                        title = "Dinner, games; fun\\night\nnext",
                        date = LocalDate.parse("2026-07-02"),
                        time = LocalTime.parse("18:30"),
                        endTime = LocalTime.parse("21:00"),
                        description = "Bring snacks, please",
                    ),
                    event(
                        id = 1,
                        title = "Breakfast",
                        date = LocalDate.parse("2026-07-01"),
                        time = LocalTime.parse("09:00"),
                        endTime = null,
                        description = "   ",
                    ),
                ),
            )

        val feed = service.buildFeed("ABC123", token)

        assertTrue(feed.startsWith("BEGIN:VCALENDAR\r\n"))
        assertTrue(feed.endsWith("END:VCALENDAR\r\n"))
        assertTrue(feed.indexOf("UID:kollekt-1") < feed.indexOf("UID:kollekt-2"))
        assertTrue(feed.contains("DTSTART:20260701T090000\r\n"))
        assertTrue(feed.contains("DTEND:20260701T100000\r\n"))
        assertTrue(feed.contains("DTEND:20260702T210000\r\n"))
        assertTrue(feed.contains("SUMMARY:Dinner\\, games\\; fun\\\\night\\nnext"))
        assertTrue(feed.contains("DESCRIPTION:Bring snacks\\, please\r\n"))
        assertFalse(feed.contains("DESCRIPTION:   "))
        verify(eventRepository).findAllByCollectiveCode("ABC123")
    }

    @Test
    fun `invalid tokens are rejected before repository access`() {
        assertThrows(IllegalArgumentException::class.java) {
            service.buildFeed("ABC123", "wrong.ics")
        }
        assertThrows(IllegalArgumentException::class.java) {
            service.buildFeed("ABC123", "00000000000000000000000000000000.ics")
        }
    }

    @Test
    fun `long content lines are folded with continuation whitespace`() {
        whenever(collectiveAccessService.requireCollectiveCodeByMemberName("Kasper")).thenReturn("ABC123")
        val token = service.feedPathForMember("Kasper").substringAfterLast('/')
        whenever(eventRepository.findAllByCollectiveCode("ABC123"))
            .thenReturn(listOf(event(id = 1, title = "x".repeat(160))))

        val feed = service.buildFeed("ABC123", token)
        val summaryLines = feed.lines().filter { it.startsWith("SUMMARY:") || it.startsWith(" ") }

        assertEquals(3, summaryLines.size)
        assertTrue(summaryLines.drop(1).all { it.startsWith(" ") })
        assertTrue(summaryLines.all { it.removeSuffix("\r").length <= 75 })
    }

    @Test
    fun `folding counts octets so multi-byte titles stay within the 75-byte limit`() {
        whenever(collectiveAccessService.requireCollectiveCodeByMemberName("Kasper")).thenReturn("ABC123")
        val token = service.feedPathForMember("Kasper").substringAfterLast('/')
        // Two bytes per character in UTF-8: folding by character would emit ~150-byte lines.
        whenever(eventRepository.findAllByCollectiveCode("ABC123"))
            .thenReturn(listOf(event(id = 1, title = "æ".repeat(120))))

        val feed = service.buildFeed("ABC123", token)
        val lines = feed.lines().map { it.removeSuffix("\r") }.filter { it.isNotEmpty() }

        assertTrue(lines.all { it.toByteArray(Charsets.UTF_8).size <= 75 }, "a folded line exceeded 75 octets")
        // Nothing was dropped or corrupted on the way through the folder.
        assertEquals(120, unfold(feed).substringAfter("SUMMARY:").substringBefore("\r\n").count { it == 'æ' })
    }

    @Test
    fun `organizer names needing escapes are quoted rather than backslash-escaped`() {
        whenever(collectiveAccessService.requireCollectiveCodeByMemberName("Kasper")).thenReturn("ABC123")
        val token = service.feedPathForMember("Kasper").substringAfterLast('/')
        whenever(eventRepository.findAllByCollectiveCode("ABC123"))
            .thenReturn(listOf(event(id = 1, title = "Dinner")))

        val feed = unfold(service.buildFeed("ABC123", token))

        // RFC 5545 has no backslash escapes for parameter values; `,` is legal only when quoted.
        assertTrue(feed.contains("ORGANIZER;CN=\"Kasper, Owner\":mailto:noreply@kollekt.app"))
        assertFalse(feed.contains("CN=Kasper\\,"))
    }

    @Test
    fun `organizer names needing no escapes are left unquoted`() {
        whenever(collectiveAccessService.requireCollectiveCodeByMemberName("Kasper")).thenReturn("ABC123")
        val token = service.feedPathForMember("Kasper").substringAfterLast('/')
        whenever(eventRepository.findAllByCollectiveCode("ABC123"))
            .thenReturn(listOf(event(id = 1, title = "Dinner", organizer = "Kasper Nyman")))

        val feed = unfold(service.buildFeed("ABC123", token))

        assertTrue(feed.contains("ORGANIZER;CN=Kasper Nyman:mailto:noreply@kollekt.app"))
    }

    /** Reverses RFC 5545 folding, so assertions can be written against whole logical lines. */
    private fun unfold(feed: String) = feed.replace("\r\n ", "")

    private fun event(
        id: Long,
        title: String,
        date: LocalDate = LocalDate.parse("2026-07-01"),
        time: LocalTime = LocalTime.parse("12:00"),
        endTime: LocalTime? = null,
        description: String? = null,
        organizer: String = "Kasper, Owner",
    ) = CalendarEvent(
        id = id,
        title = title,
        collectiveCode = "ABC123",
        date = date,
        time = time,
        endTime = endTime,
        type = EventType.OTHER,
        organizer = organizer,
        attendees = 2,
        description = description,
    )
}
