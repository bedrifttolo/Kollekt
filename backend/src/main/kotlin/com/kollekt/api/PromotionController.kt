package com.kollekt.api

import com.kollekt.api.dto.PromotionDto
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// Serves the self-served promo/announcement cards rendered by the dashboard slider (Route A).
// The list is curated here for now; it can later be backed by a table or admin tooling without
// changing the client contract.
@RestController
@RequestMapping("/api")
class PromotionController {
    @GetMapping("/promotions")
    fun getPromotions(): List<PromotionDto> = PROMOTIONS

    companion object {
        private val PROMOTIONS =
            listOf(
                PromotionDto(
                    id = "intro-faculty-tournament",
                    category = "Sport",
                    dateLabel = "Sat Apr 19 · 10:00",
                    title = "Inter-Faculty 5-a-Side Tournament",
                    body = "Register your team of 5 and compete for the faculty cup. All skill levels welcome — fun guaranteed.",
                    location = "Sports Centre",
                    ctaLabel = "Register",
                    ctaUrl = "https://example.com/tournament",
                ),
                PromotionDto(
                    id = "student-housing-fair",
                    category = "Housing",
                    dateLabel = "Wed Apr 23 · 12:00",
                    title = "Student Housing Fair",
                    body = "Meet landlords and housing co-ops looking for tenants for the autumn semester. Free entry for students.",
                    location = "Main Hall",
                    ctaLabel = "Learn more",
                    ctaUrl = "https://example.com/housing-fair",
                ),
                PromotionDto(
                    id = "local-cafe-discount",
                    category = "Offer",
                    dateLabel = "This week",
                    title = "20% Off at Bloom Café",
                    body = "Show your student app at the counter and get 20% off all drinks every weekday before noon.",
                    location = "Bloom Café, Campus North",
                    ctaLabel = "View offer",
                    ctaUrl = "https://example.com/bloom-cafe",
                ),
            )
    }
}
