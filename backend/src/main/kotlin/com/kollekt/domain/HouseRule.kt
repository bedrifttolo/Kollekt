package com.kollekt.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "house_rules")
data class HouseRule(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val collectiveCode: String,
    @Column(nullable = false) val version: Int,
    @Column(nullable = false, columnDefinition = "TEXT") val content: String,
    @Column(nullable = false) val updatedBy: String,
    @Column(nullable = false) val createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "house_rule_ack")
data class HouseRuleAck(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(nullable = false) val ruleId: Long,
    @Column(nullable = false) val memberName: String,
    @Column(nullable = false) val acknowledgedAt: Instant = Instant.now(),
)
