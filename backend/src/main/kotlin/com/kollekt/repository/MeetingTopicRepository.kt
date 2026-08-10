package com.kollekt.repository

import com.kollekt.domain.MeetingTopic
import org.springframework.data.jpa.repository.JpaRepository

interface MeetingTopicRepository : JpaRepository<MeetingTopic, Long> {
    fun findAllByCollectiveCodeAndResolvedFalseOrderByCreatedAtAsc(collectiveCode: String): List<MeetingTopic>
}
