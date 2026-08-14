package com.kollekt.repository

import com.kollekt.domain.ChatBackground
import org.springframework.data.jpa.repository.JpaRepository

interface ChatBackgroundRepository : JpaRepository<ChatBackground, Long> {
    fun findByCollectiveCodeAndThreadKey(
        collectiveCode: String,
        threadKey: String,
    ): ChatBackground?

    fun deleteByCollectiveCodeAndThreadKey(
        collectiveCode: String,
        threadKey: String,
    )
}
