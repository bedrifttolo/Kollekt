package com.kollekt.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry

@Configuration
@EnableWebSocket
class WebSocketConfig(
    private val collectiveWebSocketHandler: CollectiveWebSocketHandler,
    @Value("\${app.cors.allowed-origins}") private val allowedOrigins: String,
) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        val configuredOrigins = allowedOrigins.split(',').map { it.trim() }.filter { it.isNotBlank() }
        // The Capacitor native shells connect from fixed local origins (iOS uses
        // capacitor://localhost, Android uses https://localhost). Allow them in code so the
        // realtime socket works on device without depending on a deploy-time env var. The
        // handshake still requires a valid JWT whose subject matches the memberName, so
        // widening the origin list here does not weaken auth.
        val nativeAppOrigins = listOf("capacitor://localhost", "ionic://localhost", "http://localhost", "https://localhost")
        val originPatterns =
            (configuredOrigins + listOf("http://127.0.0.1:*", "http://localhost:*") + nativeAppOrigins).distinct()

        registry
            .addHandler(collectiveWebSocketHandler, "/ws/collective")
            .setAllowedOriginPatterns(*originPatterns.toTypedArray())
    }
}
