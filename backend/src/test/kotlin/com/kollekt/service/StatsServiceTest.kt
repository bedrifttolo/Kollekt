package com.kollekt.service

import com.kollekt.api.dto.CreateCustomAchievementRequest
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.CheckinResponse
import com.kollekt.domain.Collective
import com.kollekt.domain.CustomAchievement
import com.kollekt.domain.CustomAchievementMetric
import com.kollekt.domain.EventType
import com.kollekt.domain.Expense
import com.kollekt.domain.HouseCheckin
import com.kollekt.domain.Member
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskHistoryEntry
import com.kollekt.domain.TaskItem
import com.kollekt.repository.CheckinResponseRepository
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.CustomAchievementRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.HouseCheckinRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.ShoppingItemRepository
import com.kollekt.repository.TaskHistoryRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.TemporalAdjusters

class StatsServiceTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var customAchievementRepository: CustomAchievementRepository
    private lateinit var taskRepository: TaskRepository
    private lateinit var eventRepository: EventRepository
    private lateinit var expenseRepository: ExpenseRepository
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var economyOperations: EconomyOperations
    private lateinit var shoppingItemRepository: ShoppingItemRepository
    private lateinit var taskHistoryRepository: TaskHistoryRepository
    private lateinit var checkinRepository: HouseCheckinRepository
    private lateinit var checkinResponseRepository: CheckinResponseRepository
    private lateinit var service: StatsService

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        collectiveRepository = mock()
        customAchievementRepository = mock()
        taskRepository = mock()
        eventRepository = mock()
        expenseRepository = mock()
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        realtimeUpdateService = mock()
        economyOperations = mock()
        shoppingItemRepository = mock()
        taskHistoryRepository = mock()
        checkinRepository = mock()
        checkinResponseRepository = mock()
        service =
            StatsService(
                collectiveAccessService = collectiveAccessService,
                memberRepository = memberRepository,
                collectiveRepository = collectiveRepository,
                customAchievementRepository = customAchievementRepository,
                taskRepository = taskRepository,
                taskHistoryRepository = taskHistoryRepository,
                eventRepository = eventRepository,
                expenseRepository = expenseRepository,
                realtimeUpdateService = realtimeUpdateService,
                economyOperations = economyOperations,
                shoppingItemRepository = shoppingItemRepository,
                checkinRepository = checkinRepository,
                checkinResponseRepository = checkinResponseRepository,
            )
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com", xp = 250, level = 2))
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(
            Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1, monthlyPrize = "Pizza"),
        )
        whenever(customAchievementRepository.findAllByCollectiveCodeOrderByIdAsc("ABC123")).thenReturn(emptyList())
    }

    @Test
    fun `get dashboard aggregates collective scoped data`() {
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(
                    id = 1,
                    title = "Trash",
                    assignee = "Kasper",
                    completed = true,
                    completedAt = LocalDateTime.now().minusDays(1),
                    xp = 20,
                ),
                task(id = 2, title = "Dishes", assignee = "Emma", dueDate = LocalDate.now().plusDays(1), xp = 15),
                task(id = 3, title = "Floors", assignee = "Kasper", dueDate = LocalDate.now().plusDays(2), xp = 25),
            ),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com", xp = 250, level = 2),
                member("Emma", "emma@example.com", id = 2, xp = 150, level = 1),
            ),
        )
        whenever(eventRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                CalendarEvent(
                    id = 5,
                    title = "Movie night",
                    collectiveCode = "ABC123",
                    date = LocalDate.now().plusDays(1),
                    time = LocalTime.NOON,
                    type = EventType.MOVIE,
                    organizer = "Kasper",
                    attendees = 4,
                    description = "Snacks",
                ),
            ),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 7,
                    description = "Pizza",
                    amount = 200,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Food",
                    date = LocalDate.now(),
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )

        val result = service.getDashboard("Kasper")

        assertEquals("Villa", result.collectiveName)
        assertEquals("Kasper", result.currentUserName)
        assertEquals(1, result.currentUserRank)
        assertEquals(listOf("Dishes", "Floors"), result.upcomingTasks.map { it.title })
        assertEquals(listOf("Movie night"), result.upcomingEvents.map { it.title })
        assertEquals(listOf("Pizza"), result.recentExpenses.map { it.description })
        assertEquals(83, result.vibeScore)
    }

    @Test
    fun `get dashboard lifts the vibe when the weekly mood is high`() {
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(
                    id = 1,
                    title = "Trash",
                    assignee = "Kasper",
                    completed = true,
                    completedAt = LocalDateTime.now().minusDays(1),
                    xp = 20,
                ),
                task(id = 2, title = "Dishes", assignee = "Emma", dueDate = LocalDate.now().plusDays(1), xp = 15),
                task(id = 3, title = "Floors", assignee = "Kasper", dueDate = LocalDate.now().plusDays(2), xp = 25),
            ),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com", xp = 250, level = 2),
                member("Emma", "emma@example.com", id = 2, xp = 150, level = 1),
            ),
        )
        whenever(eventRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                CalendarEvent(
                    id = 5,
                    title = "Movie night",
                    collectiveCode = "ABC123",
                    date = LocalDate.now().plusDays(1),
                    time = LocalTime.NOON,
                    type = EventType.MOVIE,
                    organizer = "Kasper",
                    attendees = 4,
                    description = "Snacks",
                ),
            ),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                Expense(
                    id = 7,
                    description = "Pizza",
                    amount = 200,
                    paidBy = "Kasper",
                    collectiveCode = "ABC123",
                    category = "Food",
                    date = LocalDate.now(),
                    participantNames = setOf("Kasper", "Emma"),
                ),
            ),
        )
        val weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        whenever(checkinRepository.findByCollectiveCodeAndWeekStart("ABC123", weekStart))
            .thenReturn(HouseCheckin(id = 3, collectiveCode = "ABC123", weekStart = weekStart))
        whenever(checkinResponseRepository.findAllByCheckinIdOrderById(3)).thenReturn(
            listOf(
                CheckinResponse(id = 1, checkinId = 3, memberName = "Kasper", mood = 5, issue = "ok", improvement = "none"),
                CheckinResponse(id = 2, checkinId = 3, memberName = "Emma", mood = 5, issue = "ok", improvement = "none"),
            ),
        )

        val result = service.getDashboard("Kasper")

        // The same data scores 83 with a neutral mood; an average mood of 5/5 adds the capped +4 lift.
        assertEquals(87, result.vibeScore)
    }

    @Test
    fun `set monthly prize updates collective`() {
        service.setMonthlyPrize("Kasper", "Movie night")

        verify(collectiveRepository).save(
            org.mockito.kotlin.check {
                assertEquals("Movie night", it.monthlyPrize)
            },
        )
    }

    @Test
    fun `get achievements computes from task data for enabled keys`() {
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(
                    id = 1,
                    title = "Trash",
                    assignee = "Kasper",
                    completed = true,
                    completedAt = LocalDateTime.now().minusDays(1),
                    xp = 20,
                ),
                task(id = 2, title = "Dishes", assignee = "Kasper", completed = true, completedAt = LocalDateTime.now(), xp = 15),
            ),
        )

        val result = service.getAchievements("Kasper")

        assertTrue(result.isNotEmpty())
        val firstStep = result.find { it.title == "First Step" }
        assertTrue(firstStep != null && firstStep.unlocked)
    }

    @Test
    fun `get achievements catalog returns all definitions with enabled flags`() {
        val result = service.getAchievementsCatalog("Kasper")

        assertTrue(result.isNotEmpty())
        assertTrue(result.any { it.key == "TASK_1" && it.enabled })
        assertTrue(result.any { it.key == "TASK_5" && !it.enabled })
    }

    @Test
    fun `get achievements computes custom household achievement progress`() {
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(id = 1, title = "Trash", assignee = "Kasper", completed = true, completedAt = LocalDateTime.now()),
                task(id = 2, title = "Dishes", assignee = "Kasper", completed = true, completedAt = LocalDateTime.now()),
            ),
        )
        whenever(customAchievementRepository.findAllByCollectiveCodeOrderByIdAsc("ABC123")).thenReturn(
            listOf(
                CustomAchievement(
                    id = 7,
                    collectiveCode = "ABC123",
                    createdBy = "Emma",
                    title = "Double trouble",
                    description = "Complete two tasks",
                    metric = CustomAchievementMetric.TASKS_COMPLETED,
                    target = 2,
                ),
            ),
        )

        val result = service.getAchievements("Kasper").single { it.key == "CUSTOM_7" }

        assertTrue(result.custom)
        assertTrue(result.unlocked)
        assertEquals(2, result.progress)
        assertEquals("Emma", result.createdBy)
    }

    @Test
    fun `create custom achievement stores it for the household`() {
        whenever(customAchievementRepository.save(any<CustomAchievement>())).thenAnswer {
            (it.arguments[0] as CustomAchievement).copy(id = 9)
        }
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        val result =
            service.createCustomAchievement(
                "Kasper",
                CreateCustomAchievementRequest(
                    title = "  Kitchen legend  ",
                    description = "  Complete ten kitchen tasks  ",
                    metric = CustomAchievementMetric.CATEGORY_COMPLETIONS,
                    target = 10,
                    taskCategory = TaskCategory.KITCHEN,
                ),
            )

        assertEquals("Kitchen legend", result.title)
        assertEquals("CUSTOM_9", result.key)
        assertEquals("sparkles", result.icon)
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("ACHIEVEMENT_CONFIG_UPDATED"), isNull())
    }

    @Test
    fun `create custom achievement keeps a chosen icon and rejects an unknown one`() {
        whenever(customAchievementRepository.save(any<CustomAchievement>())).thenAnswer {
            (it.arguments[0] as CustomAchievement).copy(id = 11)
        }
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        val withChosenIcon =
            service.createCustomAchievement(
                "Kasper",
                CreateCustomAchievementRequest(
                    title = "Trophy hunter",
                    description = "Finish the week strong",
                    metric = CustomAchievementMetric.XP_EARNED,
                    target = 100,
                    icon = "trophy",
                ),
            )
        val withUnknownIcon =
            service.createCustomAchievement(
                "Kasper",
                CreateCustomAchievementRequest(
                    title = "Mystery goal",
                    description = "Pick a random metric",
                    metric = CustomAchievementMetric.XP_EARNED,
                    target = 100,
                    icon = "not-a-real-icon",
                ),
            )

        assertEquals("trophy", withChosenIcon.icon)
        assertEquals("sparkles", withUnknownIcon.icon)
    }

    @Test
    fun `getMemberStats returns stats for target member`() {
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2, xp = 150, level = 1))
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(id = 1, title = "Trash", assignee = "Emma", completed = true, completedAt = LocalDateTime.now().minusDays(1), xp = 20),
                task(id = 2, title = "Dishes", assignee = "Emma", completed = false, dueDate = LocalDate.now().minusDays(1), xp = 10),
                task(
                    id = 3,
                    title = "Floors",
                    assignee = "Kasper",
                    completed = true,
                    completedAt = LocalDateTime.now().minusDays(2),
                    xp = 25,
                ),
            ),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com", xp = 250, level = 2),
                member("Emma", "emma@example.com", id = 2, xp = 150, level = 1),
            ),
        )

        val result = service.getMemberStats(viewerName = "Kasper", targetName = "Emma")

        assertEquals("Emma", result.name)
        assertEquals(150, result.xp)
        assertEquals(1, result.tasksCompleted)
        assertEquals(1, result.skippedTasks)
    }

    @Test
    fun `stats include archived task history alongside live tasks`() {
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2, xp = 150, level = 1))
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(id = 1, title = "Trash", assignee = "Emma", completed = true, completedAt = LocalDateTime.now().minusDays(1), xp = 20),
            ),
        )
        whenever(taskHistoryRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskHistoryEntry(
                    id = 9,
                    collectiveCode = "ABC123",
                    assignee = "Emma",
                    completed = true,
                    completedAt = LocalDateTime.now().minusDays(30),
                    dueDate = LocalDate.now().minusDays(31),
                    category = TaskCategory.CLEANING,
                    xp = 15,
                ),
            ),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Kasper", "kasper@example.com", xp = 250, level = 2),
                member("Emma", "emma@example.com", id = 2, xp = 150, level = 1),
            ),
        )

        val result = service.getMemberStats(viewerName = "Kasper", targetName = "Emma")

        // One live completed task plus one archived completed task.
        assertEquals(2, result.tasksCompleted)
    }

    @Test
    fun `updateAchievementConfig saves enabled keys and publishes realtime event`() {
        val collective = Collective(id = 1, name = "Villa", joinCode = "ABC123", ownerMemberId = 1, monthlyPrize = null)
        whenever(collectiveRepository.findByJoinCode("ABC123")).thenReturn(collective)

        service.updateAchievementConfig("Kasper", setOf("clean_streak", "task_master"))

        verify(collectiveRepository).save(collective.copy(enabledAchievementKeys = setOf("clean_streak", "task_master")))
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("ACHIEVEMENT_CONFIG_UPDATED"), isNull())
    }

    @Test
    fun `fairness reports per-member share and balance over the window`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", "kasper@example.com"), member("Emma", "emma@example.com", id = 2)),
        )
        val now = LocalDateTime.now()
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(id = 1, title = "A", assignee = "Kasper", completed = true, completedAt = now).copy(completedBy = "Kasper"),
                task(id = 2, title = "B", assignee = "Kasper", completed = true, completedAt = now).copy(completedBy = "Kasper"),
                task(id = 3, title = "C", assignee = "Emma", completed = true, completedAt = now).copy(completedBy = "Emma"),
            ),
        )

        val result = service.getFairness("Kasper")

        assertEquals(3, result.totalTasks)
        assertEquals(2, result.shares.first().completedTasks)
        assertEquals("Kasper", result.shares.first().name)
        assertTrue(result.balancePercent in 0..100)
    }

    @Test
    fun `weekly recap summarises tasks expenses and top contributor`() {
        val now = LocalDateTime.now()
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(id = 1, title = "A", assignee = "Kasper", completed = true, completedAt = now).copy(completedBy = "Kasper"),
                task(id = 2, title = "B", assignee = "Kasper", completed = true, completedAt = now).copy(completedBy = "Kasper"),
            ),
        )
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", "kasper@example.com")),
        )
        whenever(expenseRepository.findAllByCollectiveCode("ABC123")).thenReturn(emptyList())

        val recap = service.buildWeeklyRecap("ABC123")

        assertEquals(2, recap.tasksCompleted)
        assertEquals("Kasper", recap.topContributor)
        assertEquals(2, recap.topContributorTasks)
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String? = "ABC123",
        xp: Int = 0,
        level: Int = 1,
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
        xp = xp,
        level = level,
    )

    private fun task(
        id: Long,
        title: String,
        assignee: String,
        dueDate: LocalDate = LocalDate.now(),
        completed: Boolean = false,
        completedAt: LocalDateTime? = null,
        xp: Int = 10,
    ) = TaskItem(
        id = id,
        title = title,
        assignee = assignee,
        collectiveCode = "ABC123",
        dueDate = dueDate,
        category = TaskCategory.CLEANING,
        completed = completed,
        completedAt = completedAt,
        xp = xp,
    )
}
