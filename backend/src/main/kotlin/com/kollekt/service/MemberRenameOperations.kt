package com.kollekt.service

import com.kollekt.api.dto.UserDto
import com.kollekt.repository.ChatMessageRepository
import com.kollekt.repository.CheckinResponseRepository
import com.kollekt.repository.CustomAchievementRepository
import com.kollekt.repository.EventAttendanceRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.GuestNoticeRepository
import com.kollekt.repository.HouseRuleAckRepository
import com.kollekt.repository.HouseRuleRepository
import com.kollekt.repository.KudoRepository
import com.kollekt.repository.MaintenanceTicketRepository
import com.kollekt.repository.MaintenanceTicketStatusHistoryRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.NotificationRepository
import com.kollekt.repository.PantEntryRepository
import com.kollekt.repository.PartyGameParticipantRepository
import com.kollekt.repository.PartyGameQuestionRepository
import com.kollekt.repository.PartyGameRoomRepository
import com.kollekt.repository.PersonalSettlementRepository
import com.kollekt.repository.PushDeviceTokenRepository
import com.kollekt.repository.SettlementCheckpointRepository
import com.kollekt.repository.ShoppingItemRepository
import com.kollekt.repository.TaskFeedbackRepository
import com.kollekt.repository.TaskHistoryRepository
import com.kollekt.repository.TaskRepository
import com.kollekt.repository.TaskSwapRequestRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Renames a member post-join across every table that stores memberName as a plain string
 * reference (not a real FK — see AccountOperations.updateDisplayName's doc comment for why that's
 * normally blocked). Every bulk update below is scoped to the member's own collectiveCode: member
 * names are only unique *within* a collective (V63 migration), so a global `WHERE col = :oldName`
 * would silently rename another household's rows if they share the old name.
 *
 * Two things a column UPDATE can't reach, left out of v1 on purpose:
 *  - ChatMessage.reactions/.poll — serialized JSON blobs of usernames; rewriting needs a
 *    deserialize/replace/reserialize pass per matching row, not a bulk update.
 *  - Free-text fields that may mention the name in prose (Member.chemistry/preferences/
 *    assignmentHistory, TaskItem.assignmentReason/assignmentFeedback) — not structured data.
 */
@Service
class MemberRenameOperations(
    private val memberRepository: MemberRepository,
    private val userProfileService: UserProfileService,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val taskRepository: TaskRepository,
    private val taskHistoryRepository: TaskHistoryRepository,
    private val taskFeedbackRepository: TaskFeedbackRepository,
    private val taskSwapRequestRepository: TaskSwapRequestRepository,
    private val expenseRepository: ExpenseRepository,
    private val personalSettlementRepository: PersonalSettlementRepository,
    private val settlementCheckpointRepository: SettlementCheckpointRepository,
    private val chatMessageRepository: ChatMessageRepository,
    private val kudoRepository: KudoRepository,
    private val maintenanceTicketRepository: MaintenanceTicketRepository,
    private val maintenanceTicketStatusHistoryRepository: MaintenanceTicketStatusHistoryRepository,
    private val houseRuleRepository: HouseRuleRepository,
    private val houseRuleAckRepository: HouseRuleAckRepository,
    private val checkinResponseRepository: CheckinResponseRepository,
    private val eventAttendanceRepository: EventAttendanceRepository,
    private val eventRepository: EventRepository,
    private val guestNoticeRepository: GuestNoticeRepository,
    private val pushDeviceTokenRepository: PushDeviceTokenRepository,
    private val partyGameRoomRepository: PartyGameRoomRepository,
    private val partyGameParticipantRepository: PartyGameParticipantRepository,
    private val partyGameQuestionRepository: PartyGameQuestionRepository,
    private val notificationRepository: NotificationRepository,
    private val shoppingItemRepository: ShoppingItemRepository,
    private val pantEntryRepository: PantEntryRepository,
    private val customAchievementRepository: CustomAchievementRepository,
) {
    @Transactional
    fun renameMember(
        actorName: String,
        requestedName: String,
    ): UserDto {
        val newName = requestedName.trim()
        if (newName.isBlank()) throw IllegalArgumentException("Name is required")
        if (newName.length > MAX_NAME_LENGTH) {
            throw IllegalArgumentException("Name must be at most $MAX_NAME_LENGTH characters")
        }

        val member =
            memberRepository.findByName(actorName)
                ?: throw IllegalArgumentException("Member not found")
        val collectiveCode =
            member.collectiveCode
                ?: throw IllegalArgumentException("Use /onboarding/me/name before joining a collective")

        if (newName == member.name) return userProfileService.toUserDto(member)

        if (memberRepository.findByNameAndCollectiveCodeForUpdate(newName, collectiveCode) != null) {
            throw IllegalArgumentException("A member named '$newName' already exists in this household")
        }

        val oldName = member.name

        taskRepository.renameAssignee(oldName, newName, collectiveCode)
        taskRepository.renameCompletedBy(oldName, newName, collectiveCode)
        taskHistoryRepository.renameAssignee(oldName, newName, collectiveCode)
        taskHistoryRepository.renameCompletedBy(oldName, newName, collectiveCode)
        taskFeedbackRepository.renameAuthor(oldName, newName, collectiveCode)
        taskSwapRequestRepository.renameFromUser(oldName, newName, collectiveCode)
        taskSwapRequestRepository.renameToUser(oldName, newName, collectiveCode)

        expenseRepository.renamePaidBy(oldName, newName, collectiveCode)
        expenseRepository.renameParticipant(oldName, newName, collectiveCode)
        personalSettlementRepository.renamePaidBy(oldName, newName, collectiveCode)
        personalSettlementRepository.renamePaidTo(oldName, newName, collectiveCode)
        settlementCheckpointRepository.renameSettledBy(oldName, newName, collectiveCode)

        chatMessageRepository.renameSender(oldName, newName, collectiveCode)
        chatMessageRepository.renameRecipient(oldName, newName, collectiveCode)
        kudoRepository.renameSender(oldName, newName, collectiveCode)
        kudoRepository.renameReceiver(oldName, newName, collectiveCode)

        maintenanceTicketRepository.renameAssignee(oldName, newName, collectiveCode)
        maintenanceTicketRepository.renameCreatedBy(oldName, newName, collectiveCode)
        maintenanceTicketStatusHistoryRepository.renameChangedBy(oldName, newName, collectiveCode)
        renameMaintenanceSplitParticipants(oldName, newName, collectiveCode)

        houseRuleRepository.renameUpdatedBy(oldName, newName, collectiveCode)
        houseRuleAckRepository.renameMemberName(oldName, newName, collectiveCode)
        checkinResponseRepository.renameMemberName(oldName, newName, collectiveCode)
        eventAttendanceRepository.renameMemberName(oldName, newName, collectiveCode)
        eventRepository.renameOrganizer(oldName, newName, collectiveCode)
        guestNoticeRepository.renameCreatedBy(oldName, newName, collectiveCode)
        shoppingItemRepository.renameAddedBy(oldName, newName, collectiveCode)
        pantEntryRepository.renameAddedBy(oldName, newName, collectiveCode)
        customAchievementRepository.renameCreatedBy(oldName, newName, collectiveCode)

        // Not collective-scoped: these tables carry no collective_code, matching the same
        // narrow, already-accepted cross-household risk their existing lookups have.
        pushDeviceTokenRepository.renameMemberName(oldName, newName)
        notificationRepository.renameUserName(oldName, newName)
        partyGameRoomRepository.renameHostName(oldName, newName)
        partyGameParticipantRepository.renameMemberName(oldName, newName)
        partyGameQuestionRepository.renameAuthorName(oldName, newName)

        val saved = memberRepository.save(member.copy(name = newName))
        realtimeUpdateService.publish(collectiveCode, "MEMBER_RENAMED", mapOf("oldName" to oldName, "newName" to newName))
        return userProfileService.toUserDto(saved)
    }

    // split_participants is a small comma-joined TEXT column, not queryable via a bulk column
    // UPDATE the way the other renames are — decode, replace, re-encode each affected row instead.
    private fun renameMaintenanceSplitParticipants(
        oldName: String,
        newName: String,
        collectiveCode: String,
    ) {
        val tickets = maintenanceTicketRepository.findAllByCollectiveCodeAndSplitParticipantsContaining(collectiveCode, oldName)
        tickets.forEach { ticket ->
            val names = ticket.splitParticipants?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() } ?: return@forEach
            if (oldName !in names) return@forEach
            val updated = names.map { if (it == oldName) newName else it }.joinToString(",")
            maintenanceTicketRepository.save(ticket.copy(splitParticipants = updated))
        }
    }

    private companion object {
        const val MAX_NAME_LENGTH = 40
    }
}
