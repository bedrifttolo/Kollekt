package com.kollekt.service

import com.kollekt.api.dto.UserDto
import com.kollekt.domain.MaintenancePriority
import com.kollekt.domain.MaintenanceTicket
import com.kollekt.domain.Member
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
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.check
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class MemberRenameOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var userProfileService: UserProfileService
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var taskRepository: TaskRepository
    private lateinit var taskHistoryRepository: TaskHistoryRepository
    private lateinit var taskFeedbackRepository: TaskFeedbackRepository
    private lateinit var taskSwapRequestRepository: TaskSwapRequestRepository
    private lateinit var expenseRepository: ExpenseRepository
    private lateinit var personalSettlementRepository: PersonalSettlementRepository
    private lateinit var settlementCheckpointRepository: SettlementCheckpointRepository
    private lateinit var chatMessageRepository: ChatMessageRepository
    private lateinit var kudoRepository: KudoRepository
    private lateinit var maintenanceTicketRepository: MaintenanceTicketRepository
    private lateinit var maintenanceTicketStatusHistoryRepository: MaintenanceTicketStatusHistoryRepository
    private lateinit var houseRuleRepository: HouseRuleRepository
    private lateinit var houseRuleAckRepository: HouseRuleAckRepository
    private lateinit var checkinResponseRepository: CheckinResponseRepository
    private lateinit var eventAttendanceRepository: EventAttendanceRepository
    private lateinit var eventRepository: EventRepository
    private lateinit var guestNoticeRepository: GuestNoticeRepository
    private lateinit var pushDeviceTokenRepository: PushDeviceTokenRepository
    private lateinit var partyGameRoomRepository: PartyGameRoomRepository
    private lateinit var partyGameParticipantRepository: PartyGameParticipantRepository
    private lateinit var partyGameQuestionRepository: PartyGameQuestionRepository
    private lateinit var notificationRepository: NotificationRepository
    private lateinit var shoppingItemRepository: ShoppingItemRepository
    private lateinit var pantEntryRepository: PantEntryRepository
    private lateinit var customAchievementRepository: CustomAchievementRepository
    private lateinit var operations: MemberRenameOperations

    private val member = Member(id = 1, name = "Kasper", email = "kasper@example.com", collectiveCode = "ABC123")

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        userProfileService = mock()
        realtimeUpdateService = mock()
        taskRepository = mock()
        taskHistoryRepository = mock()
        taskFeedbackRepository = mock()
        taskSwapRequestRepository = mock()
        expenseRepository = mock()
        personalSettlementRepository = mock()
        settlementCheckpointRepository = mock()
        chatMessageRepository = mock()
        kudoRepository = mock()
        maintenanceTicketRepository = mock()
        maintenanceTicketStatusHistoryRepository = mock()
        houseRuleRepository = mock()
        houseRuleAckRepository = mock()
        checkinResponseRepository = mock()
        eventAttendanceRepository = mock()
        eventRepository = mock()
        guestNoticeRepository = mock()
        pushDeviceTokenRepository = mock()
        partyGameRoomRepository = mock()
        partyGameParticipantRepository = mock()
        partyGameQuestionRepository = mock()
        notificationRepository = mock()
        shoppingItemRepository = mock()
        pantEntryRepository = mock()
        customAchievementRepository = mock()

        whenever(memberRepository.findByName("Kasper")).thenReturn(member)
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(maintenanceTicketRepository.save(any<MaintenanceTicket>())).thenAnswer { it.arguments[0] as MaintenanceTicket }
        whenever(maintenanceTicketRepository.findAllByCollectiveCodeAndSplitParticipantsContaining(any(), any()))
            .thenReturn(emptyList())
        whenever(userProfileService.toUserDto(any<Member>()))
            .thenReturn(UserDto(id = 1, name = "Kasper2", email = "kasper@example.com", collectiveCode = "ABC123"))

        operations =
            MemberRenameOperations(
                memberRepository = memberRepository,
                userProfileService = userProfileService,
                realtimeUpdateService = realtimeUpdateService,
                taskRepository = taskRepository,
                taskHistoryRepository = taskHistoryRepository,
                taskFeedbackRepository = taskFeedbackRepository,
                taskSwapRequestRepository = taskSwapRequestRepository,
                expenseRepository = expenseRepository,
                personalSettlementRepository = personalSettlementRepository,
                settlementCheckpointRepository = settlementCheckpointRepository,
                chatMessageRepository = chatMessageRepository,
                kudoRepository = kudoRepository,
                maintenanceTicketRepository = maintenanceTicketRepository,
                maintenanceTicketStatusHistoryRepository = maintenanceTicketStatusHistoryRepository,
                houseRuleRepository = houseRuleRepository,
                houseRuleAckRepository = houseRuleAckRepository,
                checkinResponseRepository = checkinResponseRepository,
                eventAttendanceRepository = eventAttendanceRepository,
                eventRepository = eventRepository,
                guestNoticeRepository = guestNoticeRepository,
                pushDeviceTokenRepository = pushDeviceTokenRepository,
                partyGameRoomRepository = partyGameRoomRepository,
                partyGameParticipantRepository = partyGameParticipantRepository,
                partyGameQuestionRepository = partyGameQuestionRepository,
                notificationRepository = notificationRepository,
                shoppingItemRepository = shoppingItemRepository,
                pantEntryRepository = pantEntryRepository,
                customAchievementRepository = customAchievementRepository,
            )
    }

    @Test
    fun `renames member across every collective-scoped table and publishes MEMBER_RENAMED`() {
        operations.renameMember("Kasper", "Kasper2")

        verify(taskRepository).renameAssignee("Kasper", "Kasper2", "ABC123")
        verify(taskRepository).renameCompletedBy("Kasper", "Kasper2", "ABC123")
        verify(taskHistoryRepository).renameAssignee("Kasper", "Kasper2", "ABC123")
        verify(taskHistoryRepository).renameCompletedBy("Kasper", "Kasper2", "ABC123")
        verify(taskFeedbackRepository).renameAuthor("Kasper", "Kasper2", "ABC123")
        verify(taskSwapRequestRepository).renameFromUser("Kasper", "Kasper2", "ABC123")
        verify(taskSwapRequestRepository).renameToUser("Kasper", "Kasper2", "ABC123")
        verify(expenseRepository).renamePaidBy("Kasper", "Kasper2", "ABC123")
        verify(expenseRepository).renameParticipant("Kasper", "Kasper2", "ABC123")
        verify(personalSettlementRepository).renamePaidBy("Kasper", "Kasper2", "ABC123")
        verify(personalSettlementRepository).renamePaidTo("Kasper", "Kasper2", "ABC123")
        verify(settlementCheckpointRepository).renameSettledBy("Kasper", "Kasper2", "ABC123")
        verify(chatMessageRepository).renameSender("Kasper", "Kasper2", "ABC123")
        verify(chatMessageRepository).renameRecipient("Kasper", "Kasper2", "ABC123")
        verify(kudoRepository).renameSender("Kasper", "Kasper2", "ABC123")
        verify(kudoRepository).renameReceiver("Kasper", "Kasper2", "ABC123")
        verify(maintenanceTicketRepository).renameAssignee("Kasper", "Kasper2", "ABC123")
        verify(maintenanceTicketRepository).renameCreatedBy("Kasper", "Kasper2", "ABC123")
        verify(maintenanceTicketStatusHistoryRepository).renameChangedBy("Kasper", "Kasper2", "ABC123")
        verify(houseRuleRepository).renameUpdatedBy("Kasper", "Kasper2", "ABC123")
        verify(houseRuleAckRepository).renameMemberName("Kasper", "Kasper2", "ABC123")
        verify(checkinResponseRepository).renameMemberName("Kasper", "Kasper2", "ABC123")
        verify(eventAttendanceRepository).renameMemberName("Kasper", "Kasper2", "ABC123")
        verify(eventRepository).renameOrganizer("Kasper", "Kasper2", "ABC123")
        verify(guestNoticeRepository).renameCreatedBy("Kasper", "Kasper2", "ABC123")
        verify(shoppingItemRepository).renameAddedBy("Kasper", "Kasper2", "ABC123")
        verify(pantEntryRepository).renameAddedBy("Kasper", "Kasper2", "ABC123")
        verify(customAchievementRepository).renameCreatedBy("Kasper", "Kasper2", "ABC123")

        // Not collective-scoped, matched by bare name only.
        verify(pushDeviceTokenRepository).renameMemberName("Kasper", "Kasper2")
        verify(notificationRepository).renameUserName("Kasper", "Kasper2")
        verify(partyGameRoomRepository).renameHostName("Kasper", "Kasper2")
        verify(partyGameParticipantRepository).renameMemberName("Kasper", "Kasper2")
        verify(partyGameQuestionRepository).renameAuthorName("Kasper", "Kasper2")

        verify(memberRepository).save(check { assertEquals("Kasper2", it.name) })
        verify(realtimeUpdateService).publish(
            eq("ABC123"),
            eq("MEMBER_RENAMED"),
            eq(mapOf("oldName" to "Kasper", "newName" to "Kasper2")),
        )
    }

    @Test
    fun `rejects a name already taken by another member in the same collective`() {
        whenever(memberRepository.findByNameAndCollectiveCodeForUpdate("Taken", "ABC123")).thenReturn(mock())

        assertThrows(IllegalArgumentException::class.java) {
            operations.renameMember("Kasper", "Taken")
        }

        verify(taskRepository, never()).renameAssignee(any(), any(), any())
        verify(memberRepository, never()).save(any<Member>())
    }

    @Test
    fun `rejects renaming before the member has joined a collective`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member.copy(collectiveCode = null))

        assertThrows(IllegalArgumentException::class.java) {
            operations.renameMember("Kasper", "NewName")
        }

        verify(memberRepository, never()).save(any<Member>())
    }

    @Test
    fun `is a no-op when the requested name matches the current name`() {
        operations.renameMember("Kasper", "Kasper")

        verify(memberRepository, never()).save(any<Member>())
        verify(realtimeUpdateService, never()).publish(any(), any(), any())
    }

    @Test
    fun `rewrites maintenance ticket split participants containing the old name`() {
        val ticket =
            MaintenanceTicket(
                id = 1,
                collectiveCode = "ABC123",
                title = "Fix sink",
                description = "",
                priority = MaintenancePriority.MEDIUM,
                splitParticipants = "Kasper,Emma",
                createdBy = "Emma",
            )
        whenever(maintenanceTicketRepository.findAllByCollectiveCodeAndSplitParticipantsContaining("ABC123", "Kasper"))
            .thenReturn(listOf(ticket))

        operations.renameMember("Kasper", "Kasper2")

        verify(maintenanceTicketRepository).save(check { assertEquals("Kasper2,Emma", it.splitParticipants) })
    }
}
