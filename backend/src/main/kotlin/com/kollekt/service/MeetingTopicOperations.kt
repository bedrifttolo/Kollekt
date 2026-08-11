package com.kollekt.service

import com.kollekt.api.dto.MeetingTopicDto
import com.kollekt.domain.Collective
import com.kollekt.domain.MeetingTopic
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MeetingTopicRepository
import com.kollekt.repository.MemberRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/** The running weekly house-meeting agenda: members propose topics, then post one to the
 *  household chat (via the normal message-send path, on the frontend) when it's time to discuss it. */
@Service
class MeetingTopicOperations(
    private val topicRepository: MeetingTopicRepository,
    private val collectiveRepository: CollectiveRepository,
    private val memberRepository: MemberRepository,
    private val realtimeUpdateService: RealtimeUpdateService,
) {
    fun listOpenTopics(
        collectiveId: Long,
        actorName: String,
    ): List<MeetingTopicDto> {
        val collective = requireCollectiveMember(collectiveId, actorName)
        return topicRepository
            .findAllByCollectiveCodeAndResolvedFalseOrderByCreatedAtAsc(collective.joinCode)
            .map { it.toDto() }
    }

    @Transactional
    fun createTopic(
        collectiveId: Long,
        title: String,
        actorName: String,
    ): MeetingTopicDto {
        val collective = requireCollectiveMember(collectiveId, actorName)
        val normalized = title.trim()
        require(normalized.isNotBlank()) { "Topic title is required" }
        require(normalized.length <= 300) { "Topic title is too long (max 300 characters)" }
        val saved =
            topicRepository.save(
                MeetingTopic(
                    collectiveCode = collective.joinCode,
                    title = normalized,
                    createdBy = actorName,
                    createdAt = Instant.now(),
                ),
            )
        val dto = saved.toDto()
        realtimeUpdateService.publish(collective.joinCode, "MEETING_TOPIC_CREATED", dto)
        return dto
    }

    @Transactional
    fun resolveTopic(
        collectiveId: Long,
        topicId: Long,
        actorName: String,
    ): MeetingTopicDto {
        val collective = requireCollectiveMember(collectiveId, actorName)
        val topic = topicRepository.findById(topicId).orElseThrow { IllegalArgumentException("Topic not found") }
        require(topic.collectiveCode == collective.joinCode) { "Topic not found" }
        val updated = topicRepository.save(topic.copy(resolved = true))
        val dto = updated.toDto()
        realtimeUpdateService.publish(collective.joinCode, "MEETING_TOPIC_RESOLVED", dto)
        return dto
    }

    private fun requireCollectiveMember(
        collectiveId: Long,
        actorName: String,
    ): Collective {
        val collective =
            collectiveRepository.findById(collectiveId).orElseThrow { IllegalArgumentException("Collective $collectiveId not found") }
        memberRepository.findByNameAndCollectiveCode(actorName, collective.joinCode)
            ?: throw AccessDeniedException("Collective access denied")
        return collective
    }

    private fun MeetingTopic.toDto() = MeetingTopicDto(id, title, createdBy, createdAt, resolved)
}
