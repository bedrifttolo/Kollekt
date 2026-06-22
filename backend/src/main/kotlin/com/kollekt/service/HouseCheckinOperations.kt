package com.kollekt.service

import com.kollekt.api.dto.CheckinResponseDto
import com.kollekt.api.dto.CheckinSummaryDto
import com.kollekt.api.dto.CreateCheckinResponseRequest
import com.kollekt.api.dto.HouseCheckinDto
import com.kollekt.domain.CheckinResponse
import com.kollekt.domain.HouseCheckin
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.CheckinResponseRepository
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.HouseCheckinRepository
import com.kollekt.repository.MemberRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

@Service
class HouseCheckinOperations(
    private val checkinRepository: HouseCheckinRepository,
    private val responseRepository: CheckinResponseRepository,
    private val collectiveRepository: CollectiveRepository,
    private val memberRepository: MemberRepository,
    private val collectiveAccessService: CollectiveAccessService,
    private val realtimeUpdateService: RealtimeUpdateService,
) {
    @Transactional
    fun generate(
        collectiveId: Long,
        actorName: String,
    ): HouseCheckinDto {
        val collective =
            collectiveRepository.findById(collectiveId).orElseThrow {
                IllegalArgumentException("Collective $collectiveId not found")
            }
        val actorCollective = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        if (actorCollective != collective.joinCode) throw AccessDeniedException("Collective access denied")
        return generateForCollective(collective.joinCode).toDto(actorName)
    }

    @Transactional
    fun generateForCollective(collectiveCode: String): HouseCheckin {
        collectiveRepository.findByJoinCodeForUpdate(collectiveCode)
            ?: throw IllegalArgumentException("Collective not found")
        val weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        return checkinRepository.findByCollectiveCodeAndWeekStart(collectiveCode, weekStart)
            ?: checkinRepository.save(HouseCheckin(collectiveCode = collectiveCode, weekStart = weekStart))
    }

    @Transactional
    fun submitResponse(
        checkinId: Long,
        request: CreateCheckinResponseRequest,
        actorName: String,
    ): CheckinResponseDto {
        val checkin = requireAccessibleCheckin(checkinId, actorName)
        require(request.mood in 1..5) { "Mood must be between 1 and 5" }
        val issue = request.issue.trim()
        val improvement = request.improvement.trim()
        require(issue.isNotBlank()) { "Issue is required" }
        require(improvement.isNotBlank()) { "Improvement is required" }
        require(!responseRepository.existsByCheckinIdAndMemberName(checkinId, actorName)) {
            "You have already responded to this check-in"
        }
        val saved =
            responseRepository.save(
                CheckinResponse(
                    checkinId = checkinId,
                    memberName = actorName,
                    mood = request.mood,
                    issue = issue,
                    improvement = improvement,
                    anonymous = request.anonymous,
                ),
            )
        realtimeUpdateService.publish(checkin.collectiveCode, "CHECKIN_UPDATED", mapOf("checkinId" to checkinId))
        return saved.toDto()
    }

    fun getSummary(
        checkinId: Long,
        actorName: String,
    ): CheckinSummaryDto {
        val checkin = requireAccessibleCheckin(checkinId, actorName)
        val responses = responseRepository.findAllByCheckinIdOrderById(checkinId)
        return CheckinSummaryDto(
            checkinId = checkin.id,
            weekStart = checkin.weekStart,
            averageMood = responses.map { it.mood }.average().takeUnless { it.isNaN() },
            responseCount = responses.size,
            memberCount = activeMemberCount(checkin.collectiveCode),
            responses = responses.map { it.toDto() },
        )
    }

    private fun requireAccessibleCheckin(
        checkinId: Long,
        actorName: String,
    ): HouseCheckin {
        val checkin = checkinRepository.findById(checkinId).orElseThrow { IllegalArgumentException("Check-in $checkinId not found") }
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        if (checkin.collectiveCode != collectiveCode) throw AccessDeniedException("Check-in access denied")
        return checkin
    }

    private fun activeMemberCount(collectiveCode: String) =
        memberRepository.findAllByCollectiveCode(collectiveCode).count { it.status == MemberStatus.ACTIVE }

    private fun HouseCheckin.toDto(actorName: String): HouseCheckinDto {
        val responses = responseRepository.findAllByCheckinIdOrderById(id)
        return HouseCheckinDto(
            id = id,
            weekStart = weekStart,
            hasResponded = responses.any { it.memberName == actorName },
            responseCount = responses.size,
            memberCount = activeMemberCount(collectiveCode),
        )
    }

    private fun CheckinResponse.toDto() =
        CheckinResponseDto(
            id = id,
            author = if (anonymous) null else memberName,
            mood = mood,
            issue = issue,
            improvement = improvement,
        )
}
