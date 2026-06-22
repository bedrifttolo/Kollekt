package com.kollekt.service

import com.kollekt.api.dto.CreateGuestNoticeRequest
import com.kollekt.api.dto.GuestNoticeDto
import com.kollekt.api.dto.QuietHoursDto
import com.kollekt.api.dto.UpdateQuietHoursRequest
import com.kollekt.domain.CollectiveQuietHours
import com.kollekt.domain.GuestNotice
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.CollectiveQuietHoursRepository
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.GuestNoticeRepository
import com.kollekt.repository.MemberRepository
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.time.LocalTime

@Service
class GuestNoticeOperations(
    private val guestNoticeRepository: GuestNoticeRepository,
    private val quietHoursRepository: CollectiveQuietHoursRepository,
    private val collectiveRepository: CollectiveRepository,
    private val memberRepository: MemberRepository,
    private val collectiveAccessService: CollectiveAccessService,
    private val notificationService: NotificationService,
    private val realtimeUpdateService: RealtimeUpdateService,
) {
    @Transactional
    fun create(
        request: CreateGuestNoticeRequest,
        actorName: String,
    ): GuestNoticeDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val guestName = request.guestName.trim()
        require(guestName.isNotBlank()) { "Guest name is required" }
        require(request.startTime != request.endTime) { "Start and end time must differ" }
        val saved =
            guestNoticeRepository.save(
                GuestNotice(
                    collectiveCode = collectiveCode,
                    createdBy = actorName,
                    guestName = guestName,
                    date = request.date,
                    startTime = request.startTime,
                    endTime = request.endTime,
                    overnight = request.overnight,
                ),
            )
        val quietHours = quietHoursRepository.findByCollectiveCode(collectiveCode)
        val overlaps = quietHours?.enabled == true && overlapsQuietHours(saved, quietHours)
        val activeMembers = memberRepository.findAllByCollectiveCode(collectiveCode).filter { it.status == MemberStatus.ACTIVE }
        notificationService.createParameterizedGroupNotification(
            userNames = activeMembers.filter { it.name != actorName }.map { it.name },
            type = "GUEST_NOTICE_CREATED",
            params = mapOf("guest" to guestName, "date" to request.date.toString(), "host" to actorName),
        )
        if (overlaps) {
            notificationService.createParameterizedGroupNotification(
                userNames = activeMembers.map { it.name },
                type = "GUEST_QUIET_HOURS_OVERLAP",
                params = mapOf("guest" to guestName, "start" to request.startTime.toString()),
            )
        }
        val dto = saved.toDto(overlaps)
        realtimeUpdateService.publish(collectiveCode, "GUEST_NOTICE_CREATED", dto)
        return dto
    }

    fun getAll(actorName: String): List<GuestNoticeDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(actorName)
        val quietHours = quietHoursRepository.findByCollectiveCode(collectiveCode)
        return guestNoticeRepository.findAllByCollectiveCodeOrderByDateAscStartTimeAsc(collectiveCode)
            .map { notice -> notice.toDto(quietHours?.enabled == true && overlapsQuietHours(notice, quietHours)) }
    }

    fun getQuietHours(
        collectiveId: Long,
        actorName: String,
    ): QuietHoursDto {
        val collective = requireCollectiveMember(collectiveId, actorName)
        val settings = quietHoursRepository.findByCollectiveCode(collective.joinCode)
        return QuietHoursDto(
            enabled = settings?.enabled ?: false,
            startTime = settings?.startTime ?: LocalTime.of(22, 0),
            endTime = settings?.endTime ?: LocalTime.of(7, 0),
            canEdit = memberRepository.findByName(actorName)?.id == collective.ownerMemberId,
        )
    }

    @Transactional
    fun updateQuietHours(
        collectiveId: Long,
        request: UpdateQuietHoursRequest,
        actorName: String,
    ): QuietHoursDto {
        val collective = requireCollectiveMember(collectiveId, actorName)
        val actor = memberRepository.findByName(actorName) ?: throw IllegalArgumentException("User not found")
        if (actor.id != collective.ownerMemberId) throw AccessDeniedException("Only the household owner can edit quiet hours")
        require(request.startTime != request.endTime) { "Start and end time must differ" }
        val existing = quietHoursRepository.findByCollectiveCode(collective.joinCode)
        val saved =
            quietHoursRepository.save(
                existing?.copy(enabled = request.enabled, startTime = request.startTime, endTime = request.endTime)
                    ?: CollectiveQuietHours(
                        collectiveCode = collective.joinCode,
                        enabled = request.enabled,
                        startTime = request.startTime,
                        endTime = request.endTime,
                    ),
            )
        realtimeUpdateService.publish(collective.joinCode, "QUIET_HOURS_UPDATED", emptyMap<String, String>())
        return QuietHoursDto(saved.enabled, saved.startTime, saved.endTime, true)
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

    private fun overlapsQuietHours(
        notice: GuestNotice,
        quietHours: CollectiveQuietHours,
    ): Boolean {
        val noticeStart = LocalDateTime.of(notice.date, notice.startTime)
        val noticeEndDate = if (notice.overnight || !notice.endTime.isAfter(notice.startTime)) notice.date.plusDays(1) else notice.date
        val noticeEnd = LocalDateTime.of(noticeEndDate, notice.endTime)
        return listOf(notice.date.minusDays(1), notice.date).any { quietDate ->
            val quietStart = LocalDateTime.of(quietDate, quietHours.startTime)
            val quietEndDate = if (!quietHours.endTime.isAfter(quietHours.startTime)) quietDate.plusDays(1) else quietDate
            val quietEnd = LocalDateTime.of(quietEndDate, quietHours.endTime)
            noticeStart < quietEnd && noticeEnd > quietStart
        }
    }

    private fun GuestNotice.toDto(overlaps: Boolean) =
        GuestNoticeDto(id, guestName, date, startTime, endTime, overnight, createdBy, overlaps)
}
