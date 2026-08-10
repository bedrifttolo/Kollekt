package com.kollekt.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.response.MockRestResponseCreators.withServerError
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder
import java.net.URI

class GoogleVisionModerationGatewayTest {
    private fun gatewayWithMockServer(apiKey: String = "test-key"): Pair<GoogleVisionModerationGateway, MockRestServiceServer> {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        return GoogleVisionModerationGateway(apiKey, builder) to server
    }

    private fun expectAnnotateCall(
        server: MockRestServiceServer,
        jsonResponse: String,
    ) {
        server
            .expect(method(org.springframework.http.HttpMethod.POST))
            .andExpect { request ->
                val uri = URI.create(request.uri.toString())
                val query = UriComponentsBuilder.fromUri(uri).build().queryParams
                assertEquals(listOf("test-key"), query["key"])
            }
            .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON))
    }

    @Test
    fun `blank api key rejects without making a network call`() {
        val gateway = GoogleVisionModerationGateway("", RestClient.builder())

        assertThrows<ModerationUnavailableException> {
            gateway.review("photo".toByteArray())
        }
    }

    @Test
    fun `allows an image with low adult and racy likelihood`() {
        val (gateway, server) = gatewayWithMockServer()
        expectAnnotateCall(
            server,
            """{"responses":[{"safeSearchAnnotation":{"adult":"VERY_UNLIKELY","racy":"UNLIKELY"}}]}""",
        )

        assertEquals(ModerationVerdict.ALLOWED, gateway.review("photo".toByteArray()))
        server.verify()
    }

    @Test
    fun `rejects an image with likely adult content`() {
        val (gateway, server) = gatewayWithMockServer()
        expectAnnotateCall(
            server,
            """{"responses":[{"safeSearchAnnotation":{"adult":"VERY_LIKELY","racy":"UNLIKELY"}}]}""",
        )

        assertEquals(ModerationVerdict.REJECTED, gateway.review("photo".toByteArray()))
    }

    @Test
    fun `rejects an image with very likely racy content`() {
        val (gateway, server) = gatewayWithMockServer()
        expectAnnotateCall(
            server,
            """{"responses":[{"safeSearchAnnotation":{"adult":"UNLIKELY","racy":"VERY_LIKELY"}}]}""",
        )

        assertEquals(ModerationVerdict.REJECTED, gateway.review("photo".toByteArray()))
    }

    @Test
    fun `treats a server error as unavailable, not as a pass`() {
        val (gateway, server) = gatewayWithMockServer()
        server.expect(method(org.springframework.http.HttpMethod.POST)).andRespond(withServerError())

        assertThrows<ModerationUnavailableException> {
            gateway.review("photo".toByteArray())
        }
    }

    @Test
    fun `treats a response with no safe search annotation as unavailable`() {
        val (gateway, server) = gatewayWithMockServer()
        expectAnnotateCall(server, """{"responses":[{}]}""")

        assertThrows<ModerationUnavailableException> {
            gateway.review("photo".toByteArray())
        }
    }
}
