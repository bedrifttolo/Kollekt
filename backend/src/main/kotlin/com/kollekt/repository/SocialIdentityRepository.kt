package com.kollekt.repository

import com.kollekt.domain.SocialIdentity
import org.springframework.data.jpa.repository.JpaRepository

interface SocialIdentityRepository : JpaRepository<SocialIdentity, Long> {
    fun findByProviderAndProviderSubject(
        provider: String,
        providerSubject: String,
    ): SocialIdentity?
}
