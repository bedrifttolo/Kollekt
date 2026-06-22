package com.kollekt.service

import com.kollekt.api.dto.HouseRulesDto
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
) {
    fun getLatest(
        collectiveId: Long,
        actorName: String,
    ): HouseRulesDto {
        val collective = requireCollectiveMember(collectiveId, actorName)
        val latest = ruleRepository.findFirstByCollectiveCodeOrderByVersionDesc(collective.joinCode)
        return latest?.toDto(actorName, collective.ownerMemberId) ?: HouseRulesDto(
            version = 0,
            content = "",
            updatedBy = null,
            createdAt = null,
            acknowledged = true,
            canEdit = memberRepository.findByName(actorName)?.id == collective.ownerMemberId,
        )
    }

    @Transactional
    fun update(
        collectiveId: Long,
        content: String,
        actorName: String,
    ): HouseRulesDto {
        val collective = requireCollectiveMember(collectiveId, actorName)
        val actor = memberRepository.findByName(actorName) ?: throw IllegalArgumentException("User not found")
        if (actor.id != collective.ownerMemberId) throw AccessDeniedException("Only the household owner can edit house rules")
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
        return saved.toDto(actorName, lockedCollective.ownerMemberId)
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
        return latest.toDto(actorName, collective.ownerMemberId)
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
        ownerMemberId: Long,
    ) = HouseRulesDto(
        version = version,
        content = content,
        updatedBy = updatedBy,
        createdAt = createdAt,
        acknowledged = ackRepository.existsByRuleIdAndMemberName(id, actorName),
        canEdit = memberRepository.findByName(actorName)?.id == ownerMemberId,
    )
}
