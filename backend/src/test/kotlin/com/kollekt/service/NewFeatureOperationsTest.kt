@file:Suppress("ktlint:standard:no-wildcard-imports")

package com.kollekt.service

import com.kollekt.api.dto.*
import com.kollekt.domain.*
import com.kollekt.repository.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.Optional

class NewFeatureOperationsTest {
    @Test
    fun `task swaps create list accept and decline`() {
        val swaps = mock<TaskSwapRequestRepository>()
        val tasks = mock<TaskRepository>()
        val feedback = mock<TaskFeedbackRepository>()
        val members = mock<MemberRepository>()
        val notifications = mock<NotificationService>()
        val realtime = mock<RealtimeUpdateService>()
        val access = mock<CollectiveAccessService>()
        val service = TaskSwapOperations(swaps, tasks, feedback, members, notifications, realtime, access)
        val task = task(7, "Alex")
        val pending = TaskSwapRequest(4, "Alex", "Bea", 7, TaskSwapRequestStatus.PENDING, Instant.now().plusSeconds(3600))
        whenever(access.requireCollectiveCodeByMemberName(any())).thenReturn("HOME")
        whenever(tasks.findByIdAndCollectiveCodeForUpdate(7, "HOME")).thenReturn(task)
        whenever(members.findByNameAndCollectiveCode("Bea", "HOME")).thenReturn(member(2, "Bea"))
        whenever(swaps.findAllByTaskIdAndStatus(7, TaskSwapRequestStatus.PENDING)).thenReturn(emptyList())
        whenever(swaps.save(any<TaskSwapRequest>())).thenAnswer {
            val value = it.arguments[0] as TaskSwapRequest
            if (value.id == 0L) value.copy(id = 4) else value
        }
        whenever(tasks.save(any<TaskItem>())).thenAnswer { it.arguments[0] }
        whenever(feedback.findAllByTaskId(7)).thenReturn(emptyList())

        assertEquals("PENDING", service.createRequest(7, "Bea", "Alex").status)

        whenever(members.findById(2)).thenReturn(Optional.of(member(2, "Bea")))
        whenever(swaps.findAllByToUserOrderByIdDesc("Bea")).thenReturn(listOf(pending))
        whenever(tasks.findAllByIdInAndCollectiveCode(listOf(7), "HOME")).thenReturn(listOf(task))
        assertEquals("Clean sink", service.getRequestsForUser(2, "Bea").single().taskTitle)

        whenever(swaps.findByIdForUpdate(4)).thenReturn(pending)
        assertEquals("ACCEPTED", service.resolveRequest(4, "accepted", "Bea").status)
        assertEquals("DECLINED", service.resolveRequest(4, "declined", "Bea").status)
        assertThrows(IllegalArgumentException::class.java) { service.resolveRequest(4, "maybe", "Bea") }
    }

    @Test
    fun `weekly checkins generate submit and summarize anonymous responses`() {
        val checkins = mock<HouseCheckinRepository>()
        val responses = mock<CheckinResponseRepository>()
        val collectives = mock<CollectiveRepository>()
        val members = mock<MemberRepository>()
        val access = mock<CollectiveAccessService>()
        val realtime = mock<RealtimeUpdateService>()
        val service = HouseCheckinOperations(checkins, responses, collectives, members, access, realtime)
        val collective = collective()
        val checkin = HouseCheckin(5, "HOME", LocalDate.now())
        val response = CheckinResponse(8, 5, "Alex", 4, "Noise", "Plan ahead", true)
        whenever(collectives.findById(1)).thenReturn(Optional.of(collective))
        whenever(collectives.findByJoinCodeForUpdate("HOME")).thenReturn(collective)
        whenever(access.requireCollectiveCodeByMemberName("Alex")).thenReturn("HOME")
        whenever(checkins.findByCollectiveCodeAndWeekStart(eq("HOME"), any())).thenReturn(null)
        whenever(checkins.save(any<HouseCheckin>())).thenReturn(checkin)
        whenever(checkins.findById(5)).thenReturn(Optional.of(checkin))
        whenever(responses.findAllByCheckinIdOrderById(5)).thenReturn(emptyList())
        whenever(responses.existsByCheckinIdAndMemberName(5, "Alex")).thenReturn(false)
        whenever(responses.save(any<CheckinResponse>())).thenReturn(response)
        whenever(members.findAllByCollectiveCode("HOME")).thenReturn(listOf(member(1, "Alex"), member(2, "Bea")))

        assertFalse(service.generate(1, "Alex").hasResponded)
        assertNull(service.submitResponse(5, CreateCheckinResponseRequest(4, " Noise ", " Plan ahead ", true), "Alex").author)
        whenever(responses.findAllByCheckinIdOrderById(5)).thenReturn(listOf(response))
        val summary = service.getSummary(5, "Alex")
        assertEquals(4.0, summary.averageMood)
        assertEquals(2, summary.memberCount)
        assertThrows(IllegalArgumentException::class.java) {
            service.submitResponse(5, CreateCheckinResponseRequest(6, "Issue", "Improve"), "Alex")
        }
    }

    @Test
    fun `house rules support empty state version updates and acknowledgement`() {
        val rules = mock<HouseRuleRepository>()
        val acknowledgements = mock<HouseRuleAckRepository>()
        val collectives = mock<CollectiveRepository>()
        val members = mock<MemberRepository>()
        val notifications = mock<NotificationService>()
        val realtime = mock<RealtimeUpdateService>()
        val chat = mock<ChatOperations>()
        val service = HouseRuleOperations(rules, acknowledgements, collectives, members, notifications, realtime, chat)
        val collective = collective()
        val owner = member(1, "Alex")
        val rule = HouseRule(10, "HOME", 1, "Be kind", "Alex")
        whenever(collectives.findById(1)).thenReturn(Optional.of(collective))
        whenever(collectives.findByJoinCodeForUpdate("HOME")).thenReturn(collective)
        whenever(members.findByName("Alex")).thenReturn(owner)
        whenever(members.findAllByCollectiveCode("HOME")).thenReturn(listOf(owner, member(2, "Bea")))
        whenever(rules.findFirstByCollectiveCodeOrderByVersionDesc("HOME")).thenReturn(null)
        assertEquals(0, service.getLatest(1, "Alex").version)
        whenever(rules.save(any<HouseRule>())).thenReturn(rule)
        whenever(acknowledgements.existsByRuleIdAndMemberName(10, "Alex")).thenReturn(false)
        assertEquals(1, service.update(1, " Be kind ", "Alex").version)

        whenever(rules.findFirstByCollectiveCodeOrderByVersionDesc("HOME")).thenReturn(rule)
        whenever(rules.findByIdForUpdate(10)).thenReturn(rule)
        assertTrue(service.acknowledge(1, 1, "Alex").acknowledged.not())
        verify(acknowledgements).save(any<HouseRuleAck>())
    }

    @Test
    fun `report violation notifies recipients and posts a household chat message`() {
        val rules = mock<HouseRuleRepository>()
        val acknowledgements = mock<HouseRuleAckRepository>()
        val collectives = mock<CollectiveRepository>()
        val members = mock<MemberRepository>()
        val notifications = mock<NotificationService>()
        val realtime = mock<RealtimeUpdateService>()
        val chat = mock<ChatOperations>()
        val service = HouseRuleOperations(rules, acknowledgements, collectives, members, notifications, realtime, chat)
        whenever(collectives.findById(1)).thenReturn(Optional.of(collective()))
        whenever(members.findByName("Alex")).thenReturn(member(1, "Alex"))
        whenever(members.findAllByCollectiveCode("HOME")).thenReturn(listOf(member(1, "Alex"), member(2, "Bea")))
        whenever(chat.postHouseholdNotice(eq("HOME"), eq("Alex"), any())).thenReturn(
            MessageDto(id = 55, sender = "Alex", text = "Quiet please", timestamp = LocalDateTime.now()),
        )

        // Whole household: notifies every active member except the reporter.
        val household = service.reportViolation(1, ReportViolationRequest("QUIET_HOURS", null, " Quiet please "), "Alex")
        assertEquals(listOf("Bea"), household.recipients)
        assertEquals(55L, household.chatMessageId)
        verify(notifications).createParameterizedGroupNotification(listOf("Bea"), "QUIET_HOURS_VIOLATION", mapOf("reporter" to "Alex"))

        // Single recipient.
        val single = service.reportViolation(1, ReportViolationRequest("HOUSE_RULE", "Bea", "Rule broken"), "Alex")
        assertEquals(listOf("Bea"), single.recipients)
        verify(notifications).createParameterizedGroupNotification(listOf("Bea"), "HOUSE_RULE_VIOLATION", mapOf("reporter" to "Alex"))

        // Unknown violation type and unknown recipient are rejected.
        assertThrows(IllegalArgumentException::class.java) {
            service.reportViolation(1, ReportViolationRequest("WHATEVER", null, "x"), "Alex")
        }
        assertThrows(IllegalArgumentException::class.java) {
            service.reportViolation(1, ReportViolationRequest("HOUSE_RULE", "Ghost", "x"), "Alex")
        }
    }

    @Test
    fun `guest notices detect quiet overlap and settings update`() {
        val notices = mock<GuestNoticeRepository>()
        val quiet = mock<CollectiveQuietHoursRepository>()
        val collectives = mock<CollectiveRepository>()
        val members = mock<MemberRepository>()
        val access = mock<CollectiveAccessService>()
        val notifications = mock<NotificationService>()
        val realtime = mock<RealtimeUpdateService>()
        val service = GuestNoticeOperations(notices, quiet, collectives, members, access, notifications, realtime)
        val collective = collective()
        val settings = CollectiveQuietHours(3, "HOME", true, LocalTime.of(22, 0), LocalTime.of(7, 0))
        val notice = GuestNotice(6, "HOME", "Alex", "Sam", LocalDate.now(), LocalTime.of(23, 0), LocalTime.of(8, 0), true)
        whenever(access.requireCollectiveCodeByMemberName("Alex")).thenReturn("HOME")
        whenever(notices.save(any<GuestNotice>())).thenReturn(notice)
        whenever(quiet.findByCollectiveCode("HOME")).thenReturn(settings)
        whenever(members.findAllByCollectiveCode("HOME")).thenReturn(listOf(member(1, "Alex"), member(2, "Bea")))
        whenever(notices.findAllByCollectiveCodeOrderByDateAscStartTimeAsc("HOME")).thenReturn(listOf(notice))
        whenever(collectives.findById(1)).thenReturn(Optional.of(collective))
        whenever(members.findByName("Alex")).thenReturn(member(1, "Alex"))
        whenever(quiet.save(any<CollectiveQuietHours>())).thenAnswer { it.arguments[0] }

        val created = service.create(CreateGuestNoticeRequest(" Sam ", notice.date, notice.startTime, notice.endTime, true), "Alex")
        assertTrue(created.overlapsQuietHours)
        assertTrue(service.getAll("Alex").single().overlapsQuietHours)
        assertTrue(service.getQuietHours(1, "Alex").canEdit)
        assertFalse(service.updateQuietHours(1, UpdateQuietHoursRequest(false, LocalTime.of(23, 0), LocalTime.of(6, 0)), "Alex").enabled)
    }

    @Test
    fun `maintenance tickets create filter assign prioritize and track status`() {
        val tickets = mock<MaintenanceTicketRepository>()
        val history = mock<MaintenanceTicketStatusHistoryRepository>()
        val members = mock<MemberRepository>()
        val access = mock<CollectiveAccessService>()
        val realtime = mock<RealtimeUpdateService>()
        val economy = mock<EconomyOperations>()
        val service = MaintenanceTicketOperations(tickets, history, members, access, realtime, economy)
        val ticket =
            MaintenanceTicket(
                9,
                "HOME",
                "Leak",
                "Pipe",
                MaintenancePriority.HIGH,
                assignee = "Bea",
                dueDate = LocalDate.now().minusDays(1),
                costEstimate = 500,
                splitParticipants = "Alex,Bea",
                createdBy = "Alex",
            )
        whenever(access.requireCollectiveCodeByMemberName("Alex")).thenReturn("HOME")
        whenever(members.findByNameAndCollectiveCode("Alex", "HOME")).thenReturn(member(1, "Alex"))
        whenever(members.findByNameAndCollectiveCode("Bea", "HOME")).thenReturn(member(2, "Bea"))
        whenever(tickets.save(any<MaintenanceTicket>())).thenAnswer {
            val value = it.arguments[0] as MaintenanceTicket
            if (value.id == 0L) value.copy(id = 9) else value
        }
        whenever(history.save(any<MaintenanceTicketStatusHistory>())).thenAnswer { it.arguments[0] }
        whenever(history.findAllByTicketIdOrderByChangedAtAsc(9)).thenReturn(emptyList())

        val created =
            service.create(
                CreateMaintenanceTicketRequest(" Leak ", "Pipe", MaintenancePriority.HIGH, "Bea", ticket.dueDate, 500),
                "Alex",
            )
        assertTrue(created.overdue)
        whenever(tickets.findAllByCollectiveCode("HOME")).thenReturn(listOf(ticket))
        assertEquals(1, service.getAll("Alex", MaintenanceStatus.OPEN, MaintenancePriority.HIGH).size)
        whenever(tickets.findByIdAndCollectiveCodeForUpdate(9, "HOME")).thenReturn(ticket)
        val done =
            service.update(
                9,
                UpdateMaintenanceTicketRequest(
                    status = MaintenanceStatus.DONE,
                    priority = MaintenancePriority.URGENT,
                    costEstimate = 750,
                    splitParticipants = listOf("Alex", "Bea"),
                ),
                "Alex",
            )
        assertEquals(MaintenanceStatus.DONE, done.status)
        assertEquals(750, done.costEstimate)
        assertFalse(done.overdue)
        verify(economy).createExpense(
            check {
                assertEquals("🔧 Leak", it.description)
                assertEquals(750, it.amount)
                assertEquals(listOf("Alex", "Bea"), it.participantNames)
            },
            eq("Alex"),
        )
    }

    @Test
    fun `kudos create feed summarize and enforce daily cap`() {
        val kudos = mock<KudoRepository>()
        val members = mock<MemberRepository>()
        val tasks = mock<TaskRepository>()
        val access = mock<CollectiveAccessService>()
        val notifications = mock<NotificationService>()
        val service = KudoOperations(kudos, members, tasks, access, notifications)
        val kudo = Kudo(3, "HOME", "Alex", "Bea", 7, "THANK_YOU", "Great help")
        whenever(access.requireCollectiveCodeByMemberName("Alex")).thenReturn("HOME")
        whenever(members.findByNameAndCollectiveCodeForUpdate("Alex", "HOME")).thenReturn(member(1, "Alex"))
        whenever(members.findByNameAndCollectiveCode("Bea", "HOME")).thenReturn(member(2, "Bea"))
        whenever(tasks.findByIdAndCollectiveCode(7, "HOME")).thenReturn(task(7, "Bea"))
        whenever(kudos.countSentInRange(eq("Alex"), any(), any())).thenReturn(0)
        whenever(kudos.save(any<Kudo>())).thenReturn(kudo)
        assertEquals("Clean sink", service.create(CreateKudoRequest("Bea", " Great help ", taskId = 7), "Alex").taskTitle)

        whenever(kudos.findAllByCollectiveCodeOrderByCreatedAtDesc("HOME")).thenReturn(listOf(kudo))
        whenever(tasks.findById(7)).thenReturn(Optional.of(task(7, "Bea")))
        assertEquals(1, service.getFeed("Alex").size)
        assertEquals(1, service.getWeeklySummary("Alex").total)

        whenever(kudos.countSentInRange(eq("Alex"), any(), any())).thenReturn(3)
        assertThrows(IllegalArgumentException::class.java) {
            service.create(CreateKudoRequest("Bea", "Again"), "Alex")
        }
    }

    private fun member(
        id: Long,
        name: String,
    ) = Member(id = id, name = name, email = "$name@example.com", collectiveCode = "HOME")

    private fun collective() = Collective(id = 1, name = "Home", joinCode = "HOME", ownerMemberId = 1)

    private fun task(
        id: Long,
        assignee: String,
    ) = TaskItem(id = id, title = "Clean sink", assignee = assignee, collectiveCode = "HOME", dueDate = LocalDate.now())
}
