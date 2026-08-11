package com.kollekt.service

import com.kollekt.domain.Collective
import com.kollekt.domain.MeetingTopic
import com.kollekt.domain.Member
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MeetingTopicRepository
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import java.util.Optional

class MeetingTopicOperationsTest {
    private lateinit var topicRepository: MeetingTopicRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var operations: MeetingTopicOperations

    private val collective = Collective(id = 1, name = "Kollektiv Cool", joinCode = "ABC123", ownerMemberId = 1)

    @BeforeEach
    fun setUp() {
        topicRepository = mock()
        collectiveRepository = mock()
        memberRepository = mock()
        realtimeUpdateService = mock()
        operations = MeetingTopicOperations(topicRepository, collectiveRepository, memberRepository, realtimeUpdateService)

        whenever(collectiveRepository.findById(1)).thenReturn(Optional.of(collective))
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(Member(name = "Kasper", email = "kasper@example.com", collectiveCode = "ABC123"))
    }

    @Test
    fun `list open topics returns unresolved topics for the collective`() {
        whenever(topicRepository.findAllByCollectiveCodeAndResolvedFalseOrderByCreatedAtAsc("ABC123")).thenReturn(
            listOf(
                MeetingTopic(id = 5, collectiveCode = "ABC123", title = "Fix the sink", createdBy = "Emma"),
            ),
        )

        val result = operations.listOpenTopics(1, "Kasper")

        assertEquals(1, result.size)
        assertEquals("Fix the sink", result.single().title)
    }

    @Test
    fun `list open topics rejects a non-member`() {
        whenever(memberRepository.findByNameAndCollectiveCode("Stranger", "ABC123")).thenReturn(null)

        assertThrows(AccessDeniedException::class.java) {
            operations.listOpenTopics(1, "Stranger")
        }
    }

    @Test
    fun `list open topics rejects an unknown collective`() {
        whenever(collectiveRepository.findById(99)).thenReturn(Optional.empty())

        assertThrows(IllegalArgumentException::class.java) {
            operations.listOpenTopics(99, "Kasper")
        }
    }

    @Test
    fun `create topic trims title and publishes realtime event`() {
        whenever(topicRepository.save(any<MeetingTopic>())).thenAnswer {
            (it.arguments[0] as MeetingTopic).copy(id = 10)
        }

        val result = operations.createTopic(1, "  Sort out recycling  ", "Kasper")

        assertEquals("Sort out recycling", result.title)
        assertEquals("Kasper", result.createdBy)
        verify(realtimeUpdateService).publish("ABC123", "MEETING_TOPIC_CREATED", result)
    }

    @Test
    fun `create topic rejects blank title`() {
        assertThrows(IllegalArgumentException::class.java) {
            operations.createTopic(1, "   ", "Kasper")
        }
        verify(topicRepository, never()).save(any<MeetingTopic>())
    }

    @Test
    fun `create topic rejects a title over 300 characters`() {
        val tooLong = "x".repeat(301)

        val error =
            assertThrows(IllegalArgumentException::class.java) {
                operations.createTopic(1, tooLong, "Kasper")
            }

        assertEquals("Topic title is too long (max 300 characters)", error.message)
    }

    @Test
    fun `resolve topic marks it resolved and publishes realtime event`() {
        whenever(topicRepository.findById(5)).thenReturn(
            Optional.of(MeetingTopic(id = 5, collectiveCode = "ABC123", title = "Fix the sink", createdBy = "Emma")),
        )
        whenever(topicRepository.save(any<MeetingTopic>())).thenAnswer { it.arguments[0] as MeetingTopic }

        val result = operations.resolveTopic(1, 5, "Kasper")

        assertTrue(result.resolved)
        verify(realtimeUpdateService).publish("ABC123", "MEETING_TOPIC_RESOLVED", result)
    }

    @Test
    fun `resolve topic rejects a topic from another collective`() {
        whenever(topicRepository.findById(6)).thenReturn(
            Optional.of(MeetingTopic(id = 6, collectiveCode = "OTHER", title = "Elsewhere", createdBy = "Emma")),
        )

        val error =
            assertThrows(IllegalArgumentException::class.java) {
                operations.resolveTopic(1, 6, "Kasper")
            }

        assertEquals("Topic not found", error.message)
    }

    @Test
    fun `resolve topic rejects an unknown topic id`() {
        whenever(topicRepository.findById(404)).thenReturn(Optional.empty())

        assertThrows(IllegalArgumentException::class.java) {
            operations.resolveTopic(1, 404, "Kasper")
        }
    }
}
