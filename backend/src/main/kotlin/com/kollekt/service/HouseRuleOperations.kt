package com.kollekt.service

import com.kollekt.api.dto.HouseRulesDto
import com.kollekt.api.dto.ReportViolationRequest
import com.kollekt.api.dto.ViolationReportDto
import com.kollekt.domain.HouseRule
import com.kollekt.domain.HouseRuleAck
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.HouseRuleAckRepository
import com.kollekt.repository.HouseRuleRepository
import com.kollekt.repository.MemberRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class HouseRuleOperations(
    private val ruleRepository: HouseRuleRepository,
    private val ackRepository: HouseRuleAckRepository,
    private val collectiveRepository: CollectiveRepository,
    private val memberRepository: MemberRepository,
    private val notificationService: NotificationService,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val chatOperations: ChatOperations,
) {
    fun getLatest(
        collectiveId: Long,
        actorName: String,
    ): HouseRulesDto {
        val collective = requireCollectiveMember(collectiveId, actorName)
        val latest = ruleRepository.findFirstByCollectiveCodeOrderByVersionDesc(collective.joinCode)
        return latest?.toDto(actorName) ?: HouseRulesDto(
            version = 0,
            content = "",
            updatedBy = null,
            createdAt = null,
            acknowledged = true,
            canEdit = true,
        )
    }

    @Transactional
    fun update(
        collectiveId: Long,
        content: String,
        actorName: String,
    ): HouseRulesDto {
        val collective = requireCollectiveMember(collectiveId, actorName)
        val lockedCollective =
            collectiveRepository.findByJoinCodeForUpdate(collective.joinCode)
                ?: throw IllegalArgumentException("Collective not found")
        val normalized = content.trim()
        require(normalized.isNotBlank()) { "House rules cannot be empty" }
        val nextVersion = (ruleRepository.findFirstByCollectiveCodeOrderByVersionDesc(lockedCollective.joinCode)?.version ?: 0) + 1
        val saved =
            ruleRepository.save(
                HouseRule(
                    collectiveCode = lockedCollective.joinCode,
                    version = nextVersion,
                    content = normalized,
                    updatedBy = actorName,
                ),
            )
        val recipients =
            memberRepository.findAllByCollectiveCode(lockedCollective.joinCode)
                .filter { it.status == MemberStatus.ACTIVE }
                .map { it.name }
        notificationService.createParameterizedGroupNotification(
            userNames = recipients,
            type = "HOUSE_RULES_UPDATED",
            params = mapOf("version" to nextVersion.toString()),
        )
        realtimeUpdateService.publish(lockedCollective.joinCode, "HOUSE_RULES_UPDATED", mapOf("version" to nextVersion))
        return saved.toDto(actorName)
    }

    @Transactional
    fun acknowledge(
        collectiveId: Long,
        version: Int,
        actorName: String,
    ): HouseRulesDto {
        val collective = requireCollectiveMember(collectiveId, actorName)
        val currentLatest =
            ruleRepository.findFirstByCollectiveCodeOrderByVersionDesc(collective.joinCode)
                ?: throw IllegalArgumentException("House rules not found")
        val latest =
            ruleRepository.findByIdForUpdate(currentLatest.id)
                ?: throw IllegalArgumentException("House rules not found")
        if (latest.version != version) throw IllegalArgumentException("Only the latest house rules can be acknowledged")
        if (!ackRepository.existsByRuleIdAndMemberName(latest.id, actorName)) {
            ackRepository.save(HouseRuleAck(ruleId = latest.id, memberName = actorName))
        }
        return latest.toDto(actorName)
    }

    // Reports a quiet-hours or house-rule violation either to a single household member or to
    // the whole household. Sends targeted violation notifications and posts one household-visible
    // chat message (its text is composed and localized by the caller).
    @Transactional
    fun reportViolation(
        collectiveId: Long,
        request: ReportViolationRequest,
        actorName: String,
    ): ViolationReportDto {
        val collective = requireCollectiveMember(collectiveId, actorName)
        val notificationType =
            when (request.violationType.uppercase()) {
                "QUIET_HOURS" -> "QUIET_HOURS_VIOLATION"
                "HOUSE_RULE" -> "HOUSE_RULE_VIOLATION"
                else -> throw IllegalArgumentException("Unknown violation type '${request.violationType}'")
            }
        val message = request.message.trim()
        require(message.isNotBlank()) { "Violation message is required" }
        require(message.length <= 1500) { "Violation message is too long (max 1500 characters)" }

        val activeMembers =
            memberRepository.findAllByCollectiveCode(collective.joinCode)
                .filter { it.status == MemberStatus.ACTIVE }
        val recipients =
            request.recipient?.trim()?.takeIf { it.isNotBlank() }?.let { target ->
                val recipient =
                    activeMembers.firstOrNull { it.name == target }
                        ?: throw IllegalArgumentException("Recipient '$target' is not an active household member")
                listOf(recipient.name)
            } ?: activeMembers.map { it.name }.filter { it != actorName }

        val reporterLabel = if (request.anonymous) BOT_SENDER else actorName
        notificationService.createParameterizedGroupNotification(
            userNames = recipients,
            type = notificationType,
            params = mapOf("reporter" to reporterLabel),
        )
        val chatMessage = chatOperations.postHouseholdNotice(collective.joinCode, reporterLabel, message)

        return ViolationReportDto(recipients = recipients, chatMessageId = chatMessage.id)
    }

    private fun requireCollectiveMember(
        collectiveId: Long,
        actorName: String,
    ): com.kollekt.domain.Collective {
        val collective =
            collectiveRepository.findById(
                collectiveId,
            ).orElseThrow { IllegalArgumentException("Collective $collectiveId not found") }
        val member = memberRepository.findByName(actorName) ?: throw IllegalArgumentException("User not found")
        if (member.collectiveCode != collective.joinCode) throw AccessDeniedException("Collective access denied")
        return collective
    }

    private fun HouseRule.toDto(
        actorName: String,
    ) = HouseRulesDto(
        version = version,
        content = content,
        updatedBy = updatedBy,
        createdAt = createdAt,
        acknowledged = ackRepository.existsByRuleIdAndMemberName(id, actorName),
        canEdit = true,
    )

    companion object {
        // Display name used as the chat sender (and notification reporter) when a violation is
        // reported anonymously, so it reads as an automated household notice rather than a person.
        private const val BOT_SENDER = "Kollekt Bot 🤖"
    }
}
