package com.kollekt.config

import com.kollekt.repository.MemberRepository
import org.springframework.core.convert.converter.Converter
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter

/**
 * The JWT `sub` claim is the member id (see TokenService), but every controller still reads
 * `jwt.subject` expecting the member's current display name. This converter resolves the token
 * to a member by the unambiguous numeric `uid` claim and rewrites `sub` to that member's name
 * before Spring Security exposes the principal — so `jwt.subject` keeps meaning "current name"
 * everywhere downstream, without touching every controller call site.
 *
 * Falls back to treating `sub` itself as the lookup key (by id, then by name) for tokens issued
 * before the `uid` claim existed or before `sub` became the id.
 *
 * Deliberately NOT a `@Component`: Spring MVC test slices auto-detect any `Converter` bean in the
 * context, so a component-scanned instance would demand a real `MemberRepository` in every
 * `@WebMvcTest`. [SecurityConfig] constructs it directly instead, so it only exists where the
 * real security filter chain is wired up.
 */
class MemberJwtAuthenticationConverter(
    private val memberRepository: MemberRepository,
) : Converter<Jwt, AbstractAuthenticationToken> {
    private val delegate = JwtAuthenticationConverter()

    override fun convert(jwt: Jwt): AbstractAuthenticationToken {
        val member =
            (jwt.claims["uid"] as? Number)?.toLong()?.let { memberRepository.findById(it).orElse(null) }
                ?: jwt.subject.toLongOrNull()?.let { memberRepository.findById(it).orElse(null) }
                ?: memberRepository.findByName(jwt.subject)

        val resolved =
            if (member != null) {
                Jwt
                    .withTokenValue(jwt.tokenValue)
                    .headers { it.putAll(jwt.headers) }
                    .claims { it.putAll(jwt.claims) }
                    .claim("sub", member.name)
                    .build()
            } else {
                jwt
            }

        return delegate.convert(resolved)!!
    }
}
