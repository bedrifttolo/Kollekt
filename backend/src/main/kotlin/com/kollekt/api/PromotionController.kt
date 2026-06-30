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
        private val PROMOTIONS = emptyList<PromotionDto>()
    }
}
