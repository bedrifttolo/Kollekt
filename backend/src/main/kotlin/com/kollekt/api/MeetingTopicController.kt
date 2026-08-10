package com.kollekt.api

import com.kollekt.api.dto.CreateMeetingTopicRequest
import com.kollekt.api.dto.MeetingTopicDto
import com.kollekt.service.MeetingTopicOperations
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class MeetingTopicController(
    private val operations: MeetingTopicOperations,
) {
    @GetMapping("/api/collectives/{collectiveId}/meeting-topics")
    fun listOpenTopics(
        @PathVariable collectiveId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<MeetingTopicDto> = operations.listOpenTopics(collectiveId, jwt.subject)

    @PostMapping("/api/collectives/{collectiveId}/meeting-topics")
    fun createTopic(
        @PathVariable collectiveId: Long,
        @RequestBody request: CreateMeetingTopicRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): MeetingTopicDto = operations.createTopic(collectiveId, request.title, jwt.subject)

    @PostMapping("/api/collectives/{collectiveId}/meeting-topics/{topicId}/resolve")
    fun resolveTopic(
        @PathVariable collectiveId: Long,
        @PathVariable topicId: Long,
        @AuthenticationPrincipal jwt: Jwt,
    ): MeetingTopicDto = operations.resolveTopic(collectiveId, topicId, jwt.subject)
}
