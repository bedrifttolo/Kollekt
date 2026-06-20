package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

@Entity
@Table(
    name = "social_identities",
    uniqueConstraints = [UniqueConstraint(columnNames = ["provider", "provider_subject"])],
)
data class SocialIdentity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val provider: String,
    @Column(name = "provider_subject", nullable = false) val providerSubject: String,
    @Column(name = "member_id", nullable = false) val memberId: Long,
)
