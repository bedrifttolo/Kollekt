package com.kollekt.service

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.util.Base64

enum class ModerationVerdict { ALLOWED, REJECTED }

/** Thrown when the moderation provider can't be reached or returns something we can't parse — the
 *  caller must treat this as "could not verify," never as "verified safe." */
class ModerationUnavailableException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

interface ImageModerationGateway {
    /** @throws ModerationUnavailableException if the provider can't be called or its response can't be parsed. */
    fun review(imageBytes: ByteArray): ModerationVerdict

    /**
     * False when the provider has no credentials configured at all. Distinguishes "this
     * deployment never set a key" — which [ImageSafetyService] lets through, so an un-keyed
     * environment isn't an app with permanently broken photo upload — from "the provider is
     * configured but unreachable right now", which still fails closed.
     */
    fun isConfigured(): Boolean
}

/**
 * Calls Google Cloud Vision's SafeSearch Detection over its plain REST endpoint (not the
 * `google-cloud-vision` client library, which pulls in a full gRPC stack for one annotate call).
 * A blank [apiKey] means this deployment never configured moderation, which [isConfigured]
 * reports so [ImageSafetyService] can skip the check rather than reject every upload. Once a key
 * *is* present, [review] fails closed — a Vision outage throws [ModerationUnavailableException]
 * instead of silently allowing images through, unlike push notifications where a no-op send is
 * harmless.
 */
@Component
class GoogleVisionModerationGateway(
    @Value("\${app.moderation.google-vision-api-key:}") private val apiKey: String,
    restClientBuilder: RestClient.Builder = RestClient.builder(),
) : ImageModerationGateway {
    private val log = LoggerFactory.getLogger(GoogleVisionModerationGateway::class.java)
    private val restClient = restClientBuilder.baseUrl("https://vision.googleapis.com/v1").build()

    // SafeSearch likelihood buckets, in order: UNKNOWN, VERY_UNLIKELY, UNLIKELY, POSSIBLE, LIKELY,
    // VERY_LIKELY. Rejecting at LIKELY+ for "adult" (explicit nudity/sexual content) and only at
    // VERY_LIKELY for "racy" avoids over-blocking swimwear/fitness photos while still catching
    // actual nudity.
    private val rejectAdultAt = setOf("LIKELY", "VERY_LIKELY")
    private val rejectRacyAt = setOf("VERY_LIKELY")

    override fun isConfigured(): Boolean = apiKey.isNotBlank()

    override fun review(imageBytes: ByteArray): ModerationVerdict {
        if (apiKey.isBlank()) {
            throw ModerationUnavailableException("Image moderation is not configured (GOOGLE_CLOUD_VISION_API_KEY unset)")
        }

        val requestBody =
            mapOf(
                "requests" to
                    listOf(
                        mapOf(
                            "image" to mapOf("content" to Base64.getEncoder().encodeToString(imageBytes)),
                            "features" to listOf(mapOf("type" to "SAFE_SEARCH_DETECTION")),
                        ),
                    ),
            )

        val response =
            try {
                restClient
                    .post()
                    .uri { it.path("/images:annotate").queryParam("key", apiKey).build() }
                    .body(requestBody)
                    .retrieve()
                    .body(VisionAnnotateResponse::class.java)
            } catch (ex: Exception) {
                log.warn("Vision SafeSearch call failed", ex)
                throw ModerationUnavailableException("Could not reach the image moderation service", ex)
            }

        val safeSearch =
            response
                ?.responses
                ?.firstOrNull()
                ?.safeSearchAnnotation
                ?: throw ModerationUnavailableException("Image moderation service returned an unexpected response")

        val rejected = safeSearch.adult in rejectAdultAt || safeSearch.racy in rejectRacyAt
        return if (rejected) ModerationVerdict.REJECTED else ModerationVerdict.ALLOWED
    }
}

private data class VisionAnnotateResponse(
    val responses: List<VisionResponse> = emptyList(),
)

private data class VisionResponse(
    val safeSearchAnnotation: VisionSafeSearchAnnotation? = null,
)

private data class VisionSafeSearchAnnotation(
    val adult: String = "UNKNOWN",
    val racy: String = "UNKNOWN",
)
