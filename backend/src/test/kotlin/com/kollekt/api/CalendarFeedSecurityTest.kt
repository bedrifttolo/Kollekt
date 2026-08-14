package com.kollekt.api

import com.kollekt.config.SecurityConfig
import com.kollekt.repository.MemberRepository
import com.kollekt.service.CalendarFeedService
import com.kollekt.service.TokenStoreService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/**
 * Guards the one security rule the calendar subscription depends on. Everything else in the API is
 * authenticated, so the feed's `permitAll` matcher is the only thing standing between a calendar
 * app and a 401 — and it has to cover HEAD as well as GET, because clients probe the URL with HEAD
 * before accepting a subscription.
 *
 * Note the missing `test` profile: [SecurityConfig] is `@Profile("!test")`, so a test that runs
 * under the usual profile would assert against no security chain at all.
 */
@WebMvcTest(
    controllers = [CalendarFeedController::class],
    properties = [
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough",
        "app.cors.allowed-origins=http://localhost:5173",
        "app.security.auth-rate-limit-per-minute=60",
    ],
)
@Import(SecurityConfig::class)
class CalendarFeedSecurityTest {
    @Autowired lateinit var mockMvc: MockMvc

    @MockitoBean lateinit var calendarFeedService: CalendarFeedService

    @MockitoBean lateinit var tokenStoreService: TokenStoreService

    @MockitoBean lateinit var memberRepository: MemberRepository

    @Test
    fun `anonymous GET of a signed feed URL is allowed`() {
        whenever(calendarFeedService.buildFeed("ABC123", "signed.ics"))
            .thenReturn("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n")

        mockMvc
            .perform(get("/api/calendar-feed/ABC123/signed.ics"))
            .andExpect(status().isOk)
            .andExpect(content().string("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"))
    }

    @Test
    fun `anonymous HEAD of a signed feed URL is allowed`() {
        whenever(calendarFeedService.buildFeed("ABC123", "signed.ics"))
            .thenReturn("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n")

        // Was 401: the matcher listed GET only, so Spring Security rejected the probe before
        // Spring MVC could answer HEAD from the @GetMapping.
        mockMvc
            .perform(head("/api/calendar-feed/ABC123/signed.ics"))
            .andExpect(status().isOk)
    }

    @Test
    fun `anonymous access to any other endpoint is still rejected`() {
        mockMvc
            .perform(get("/api/events"))
            .andExpect(status().isUnauthorized)
    }
}
