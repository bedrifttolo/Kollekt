package com.kollekt.service

import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component

/**
 * Resolves the member behind the current request. Always goes through the numeric `uid` claim
 * (never a bare name lookup) — member names are only unique within a collective, so a global
 * findByName-by-name would be ambiguous the moment two members in different collectives share a
 * name.
 */
@Component
class CurrentMemberContext(
    private val memberRepository: MemberRepository,
) {
    /** Resolves from the request's authenticated principal — usable deep in the service layer,
     *  where an explicit [Jwt] usually isn't in scope. */
    fun current(): Member = current(currentJwt())

    /** Resolves the caller and asserts they are who [expectedName] claims — the standard shape
     *  for a service method that receives a `memberName: String` the controller already proved
     *  belongs to the caller (see [requireTokenSubject]), and needs its own identity back without
     *  a bare, collective-unaware name lookup. */
    fun current(expectedName: String): Member =
        current().also {
            require(it.name == expectedName) { "User '$expectedName' not found" }
        }

    fun current(jwt: Jwt): Member {
        val id =
            (jwt.claims["uid"] as? Number)?.toLong()
                ?: throw AccessDeniedException("Token is missing member identity")
        return memberRepository.findById(id).orElseThrow {
            AccessDeniedException("Token does not match a known member")
        }
    }

    fun requireTokenSubject(
        jwt: Jwt,
        memberName: String,
    ) {
        if (current(jwt).name != memberName) {
            throw AccessDeniedException("Token subject does not match requested member")
        }
    }

    private fun currentJwt(): Jwt {
        val authentication =
            SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
                ?: throw AccessDeniedException("No authenticated request context")
        return authentication.token
    }
}
