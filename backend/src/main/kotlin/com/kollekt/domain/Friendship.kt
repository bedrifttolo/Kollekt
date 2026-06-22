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
    name = "friendships",
    uniqueConstraints = [UniqueConstraint(columnNames = ["member_id", "friend_id"])],
)
data class Friendship(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(name = "member_id", nullable = false) val memberId: Long,
    @Column(name = "friend_id", nullable = false) val friendId: Long,
)
