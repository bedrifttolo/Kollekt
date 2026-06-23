package com.kollekt.service

import com.kollekt.api.dto.WeeklyRecapDto
import com.kollekt.domain.Collective
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDate

class StudentLivingMaintenanceServiceTest {
    private lateinit var economyOperations: EconomyOperations
    private lateinit var memberOperations: MemberOperations
    private lateinit var statsService: StatsService
    private lateinit var notificationService: NotificationService
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var service: StudentLivingMaintenanceService

    @BeforeEach
    fun setUp() {
        economyOperations = mock()
        memberOperations = mock()
        statsService = mock()
        notificationService = mock()
        collectiveRepository = mock()
        memberRepository = mock()
        service =
            StudentLivingMaintenanceService(
                economyOperations,
                memberOperations,
                statsService,
                notificationService,
                collectiveRepository,
                memberRepository,
            )
    }

    @Test
    fun `generate recurring expenses delegates to economy operations`() {
        service.generateRecurringExpenses()

        verify(economyOperations).generateRecurringExpenseInstances()
    }

    @Test
    fun `resume away members delegates to member operations`() {
        service.resumeAwayMembers()

        verify(memberOperations).resumeExpiredAwayMembers()
    }

    @Test
    fun `weekly recap notifies active members when there is activity`() {
        whenever(collectiveRepository.findAll()).thenReturn(
            listOf(Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1)),
        )
        whenever(statsService.buildWeeklyRecap("ABC123")).thenReturn(
            WeeklyRecapDto(
                weekStart = LocalDate.now().minusDays(6),
                tasksCompleted = 4,
                topContributor = "Kasper",
                topContributorTasks = 3,
                expensesLogged = 1,
                bestStreak = 2,
                bestStreakHolder = "Kasper",
            ),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Member(id = 1, name = "Kasper", email = "k@e.com", collectiveCode = "ABC123"),
                Member(id = 2, name = "Emma", email = "e@e.com", collectiveCode = "ABC123", status = MemberStatus.AWAY),
            ),
        )

        service.sendWeeklyRecaps()

        verify(notificationService).createParameterizedGroupNotification(eq(listOf("Kasper")), eq("WEEKLY_RECAP"), any())
    }

    @Test
    fun `weekly recap is skipped when the week had no activity`() {
        whenever(collectiveRepository.findAll()).thenReturn(
            listOf(Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1)),
        )
        whenever(statsService.buildWeeklyRecap("ABC123")).thenReturn(
            WeeklyRecapDto(
                weekStart = LocalDate.now().minusDays(6),
                tasksCompleted = 0,
                topContributor = null,
                topContributorTasks = 0,
                expensesLogged = 0,
                bestStreak = 0,
                bestStreakHolder = null,
            ),
        )

        service.sendWeeklyRecaps()

        verify(notificationService, never()).createParameterizedGroupNotification(any(), any(), any())
    }
}
