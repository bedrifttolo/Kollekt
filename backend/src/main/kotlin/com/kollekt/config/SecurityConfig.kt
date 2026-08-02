package com.kollekt.config

import com.kollekt.repository.MemberRepository
import com.kollekt.service.TokenStoreService
import com.nimbusds.jose.jwk.source.ImmutableSecret
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.http.HttpMethod
import org.springframework.security.config.Customizer
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import javax.crypto.spec.SecretKeySpec

@Configuration
@EnableWebSecurity
@Profile("!test")
class SecurityConfig(
    @Value("\${app.security.jwt-secret}") private val jwtSecret: String,
    @Value("\${app.cors.allowed-origins}") private val allowedOrigins: String,
    @Value("\${app.security.auth-rate-limit-per-minute}") private val authRateLimitPerMinute: Int,
    private val tokenStoreService: TokenStoreService,
    private val memberRepository: MemberRepository,
) {
    init {
        // Fail fast rather than sign tokens with a guessable secret. The insecure default in
        // application.yml is a placeholder for local scaffolding only — production MUST set a
        // unique random APP_SECURITY_JWT_SECRET, otherwise anyone could forge auth tokens.
        require(jwtSecret != INSECURE_JWT_SECRET_DEFAULT && jwtSecret.length >= 32) {
            "APP_SECURITY_JWT_SECRET must be a unique random value of at least 32 characters. " +
                "Refusing to start with the insecure default — set it in the deployment environment."
        }
    }

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain =
        http
            .csrf { it.disable() }
            .cors(Customizer.withDefaults())
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .addFilterBefore(
                AuthRateLimitFilter(authRateLimitPerMinute),
                UsernamePasswordAuthenticationFilter::class.java,
            )
            .authorizeHttpRequests {
                it.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                it
                    .requestMatchers(
                        "/api/onboarding/oauth/*",
                        "/api/onboarding/refresh",
                        "/api/google-calendar/callback",
                    ).permitAll()
                it.requestMatchers(HttpMethod.GET, "/api/calendar-feed/**").permitAll()
                it.requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                it.requestMatchers("/ws/**").permitAll()
                it.anyRequest().authenticated()
            }.oauth2ResourceServer {
                it.jwt { jwt -> jwt.jwtAuthenticationConverter(MemberJwtAuthenticationConverter(memberRepository)) }
            }
            .build()

    @Bean
    fun jwtDecoder(): JwtDecoder {
        val key = SecretKeySpec(jwtSecret.toByteArray(), "HmacSHA256")
        val decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build()
        val defaultValidator = JwtValidators.createDefault()
        val revokedValidator = RevokedTokenValidator(tokenStoreService)
        decoder.setJwtValidator(
            DelegatingOAuth2TokenValidator<Jwt>(defaultValidator, revokedValidator),
        )
        return decoder
    }

    @Bean
    fun jwtEncoder(): JwtEncoder {
        val key = SecretKeySpec(jwtSecret.toByteArray(), "HmacSHA256")
        return NimbusJwtEncoder(ImmutableSecret(key))
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration()
        configuration.allowedOrigins = allowedOrigins.split(',').map { it.trim() }
        configuration.allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        configuration.allowedHeaders = listOf("*")
        configuration.allowCredentials = true

        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/api/**", configuration)
        source.registerCorsConfiguration("/ws/**", configuration)
        return source
    }

    private companion object {
        const val INSECURE_JWT_SECRET_DEFAULT = "change-me-to-a-long-random-secret-at-least-32-chars"
    }
}
