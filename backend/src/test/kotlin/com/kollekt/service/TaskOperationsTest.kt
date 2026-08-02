package com.kollekt.service

import com.kollekt.api.dto.CreateTaskRequest
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskFeedback
import com.kollekt.domain.TaskHistoryEntry
import com.kollekt.domain.TaskItem
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskFeedbackRepository
import com.kollekt.repository.TaskHistoryRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.check
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Optional

class TaskOperationsTest {
    private lateinit var taskRepository: TaskRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var notificationService: NotificationService
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var currentMemberContext: CurrentMemberContext
    private lateinit var taskFeedbackRepository: TaskFeedbackRepository
    private lateinit var taskHistoryRepository: TaskHistoryRepository
    private lateinit var operations: TaskOperations

    @BeforeEach
    fun setUp() {
        taskRepository = mock()
        memberRepository = mock()
        collectiveRepository = mock()
        realtimeUpdateService = mock()
        notificationService = mock()
        taskFeedbackRepository = mock()
        taskHistoryRepository = mock()
        currentMemberContext = mock()
        collectiveAccessService = CollectiveAccessService(currentMemberContext, collectiveRepository)
        operations =
            TaskOperations(
                taskRepository = taskRepository,
                memberRepository = memberRepository,
                taskFeedbackRepository = taskFeedbackRepository,
                realtimeUpdateService = realtimeUpdateService,
                notificationService = notificationService,
                collectiveAccessService = collectiveAccessService,
                taskHistoryRepository = taskHistoryRepository,
            )
        whenever(currentMemberContext.current("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
    }

    @Test
    fun `notify upcoming task deadlines publishes realtime reminder and notification`() {
        val dueSoon =
            TaskItem(
                id = 8,
                title = "Trash",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().plusDays(1),
                category = TaskCategory.OTHER,
            )
        whenever(taskRepository.findAll()).thenReturn(listOf(dueSoon))

        operations.notifyUpcomingTaskDeadlines(reminderDaysBeforeDue = 1)

        verify(realtimeUpdateService).publish(
            "ABC123",
            "TASK_DEADLINE_SOON",
            mapOf(
                "assignee" to "Kasper",
                "taskId" to 8L,
                "title" to "Trash",
                "dueDate" to dueSoon.dueDate.toString(),
            ),
        )
        verify(notificationService).createParameterizedNotification(
            userName = "Kasper",
            type = "TASK_DEADLINE_SOON",
            params = mapOf("title" to "Trash", "days" to "1"),
        )
    }

    @Test
    fun `create task normalizes recurrence clears caches and notifies assignee`() {
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2))

        val taskCaptor = argumentCaptor<TaskItem>()
        whenever(taskRepository.save(taskCaptor.capture())).thenAnswer {
            taskCaptor.firstValue.copy(id = 12)
        }

        val result =
            operations.createTask(
                request =
                    CreateTaskRequest(
                        title = "  Vask  ",
                        assignee = "Emma",
                        dueDate = LocalDate.parse("2026-04-20"),
                        category = TaskCategory.CLEANING,
                        xp = 15,
                        recurrenceRule = " weekly ",
                    ),
                actorName = "Kasper",
            )

        assertEquals("ABC123", taskCaptor.firstValue.collectiveCode)
        assertEquals("WEEKLY", taskCaptor.firstValue.recurrenceRule)
        assertTrue(taskCaptor.firstValue.recurring)
        verify(notificationService).createTaskAssignedNotification("Emma", "Vask")
        verify(realtimeUpdateService).publish("ABC123", "TASK_CREATED", result)
    }

    @Test
    fun `create task rejects blank title and invalid xp`() {
        val blankTitle =
            CreateTaskRequest("   ", "Emma", LocalDate.parse("2026-04-20"), TaskCategory.CLEANING, 10)
        val invalidXp =
            CreateTaskRequest("Sink", "Emma", LocalDate.parse("2026-04-20"), TaskCategory.SMALL_CLEANING, 0)

        assertEquals(
            "Task title is required",
            assertThrows<IllegalArgumentException> { operations.createTask(blankTitle, "Kasper") }.message,
        )
        assertEquals(
            "Task XP must be between 1 and 1000",
            assertThrows<IllegalArgumentException> {
                operations.createTask(invalidXp, "Kasper")
            }.message,
        )
    }

    @Test
    fun `update task falls back invalid category and enables weekly recurrence`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(3, "ABC123")).thenReturn(
            TaskItem(
                id = 3,
                title = "Old",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-04-01"),
                category = TaskCategory.CLEANING,
                xp = 10,
                recurring = false,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2))
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result =
            operations.updateTask(
                taskId = 3,
                updates =
                    mapOf(
                        "title" to "New",
                        "assignee" to "Emma",
                        "dueDate" to "2026-04-15",
                        "category" to "INVALID",
                        "xp" to 25,
                        "recurring" to true,
                    ),
                memberName = "Kasper",
            )

        assertEquals("New", result.title)
        assertEquals("Emma", result.assignee)
        assertEquals(LocalDate.parse("2026-04-15"), result.dueDate)
        assertEquals(TaskCategory.CLEANING, result.category)
        assertEquals(25, result.xp)
        assertEquals("WEEKLY", result.recurrenceRule)
    }

    @Test
    fun `toggle task awards half xp for overdue completion and publishes xp update`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(11, "ABC123")).thenReturn(
            TaskItem(
                id = 11,
                title = "Task",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(1),
                category = TaskCategory.OTHER,
                completed = false,
                xpAwarded = false,
                xp = 25,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(
                member("Kasper", "kasper@example.com", xp = 100, level = 1),
                member("Kasper", "kasper@example.com", xp = 112, level = 1),
            )
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result = operations.toggleTask(taskId = 11, memberName = "Kasper")

        assertTrue(result.completed)
        verify(memberRepository).save(
            org.mockito.kotlin.check {
                assertEquals(112, it.xp)
                assertEquals(1, it.level)
            },
        )
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("XP_UPDATED"), any())
    }

    @Test
    fun `penalize missed tasks applies penalty once and notifies collective`() {
        val overdueTask =
            TaskItem(
                id = 4,
                title = "Trash",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(1),
                category = TaskCategory.OTHER,
                xp = 10,
            )
        whenever(taskRepository.findAll()).thenReturn(listOf(overdueTask))
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2, xp = 40))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Emma", "emma@example.com", id = 2, xp = 40),
                member("Kasper", "kasper@example.com", id = 1, xp = 20),
                member("Ola", "ola@example.com", id = 3, status = MemberStatus.AWAY),
            ),
        )
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        operations.penalizeMissedTasks()

        verify(memberRepository).save(
            org.mockito.kotlin.check {
                assertEquals("Emma", it.name)
                assertEquals(30, it.xp)
            },
        )
        verify(taskRepository).save(
            org.mockito.kotlin.check {
                assertEquals(-10, it.penaltyXp)
            },
        )
        verify(notificationService).createParameterizedNotification(
            userName = "Emma",
            type = "TASK_OVERDUE",
            params = mapOf("title" to "Trash"),
        )
        verify(notificationService).createParameterizedGroupNotification(
            userNames = listOf("Kasper"),
            type = "TASK_OVERDUE_GROUP",
            params = mapOf("title" to "Trash", "assignee" to "Emma"),
        )
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("TASK_PENALTY_APPLIED"), any())
    }

    @Test
    fun `regret missed task removes penalty and awards half xp`() {
        val task =
            TaskItem(
                id = 9,
                title = "Kitchen",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(2),
                category = TaskCategory.CLEANING,
                completed = false,
                xp = 20,
                penaltyXp = -20,
            )
        whenever(taskRepository.findById(9)).thenReturn(Optional.of(task))
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2, xp = 100))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result = operations.regretMissedTask(taskId = 9, memberName = "Emma")

        assertTrue(result.completed)
        verify(memberRepository).save(
            org.mockito.kotlin.check {
                assertEquals(130, it.xp)
            },
        )
    }

    @Test
    fun `get tasks returns tasks sorted by due date and id`() {
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(
                    id = 3,
                    title = "Bathroom",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-04-20"),
                    category = TaskCategory.OTHER,
                ),
                TaskItem(
                    id = 2,
                    title = "Trash",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-04-15"),
                    category = TaskCategory.OTHER,
                ),
                TaskItem(
                    id = 1,
                    title = "Kitchen",
                    assignee = "Emma",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.parse("2026-04-15"),
                    category = TaskCategory.CLEANING,
                ),
            ),
        )

        val result = operations.getTasks("Kasper")

        assertEquals(listOf(1L, 2L, 3L), result.map { it.id })
    }

    @Test
    fun `create task rejects assignee outside the collective`() {
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123")).thenReturn(null)

        val error =
            assertThrows<IllegalArgumentException> {
                operations.createTask(
                    request =
                        CreateTaskRequest(
                            title = "Vask",
                            assignee = "Emma",
                            dueDate = LocalDate.parse("2026-04-20"),
                            category = TaskCategory.CLEANING,
                            xp = 15,
                        ),
                    actorName = "Kasper",
                )
            }

        assertEquals("Assignee 'Emma' is not in your collective", error.message)
    }

    @Test
    fun `delete expired tasks archives and removes completed tasks older than seven days only`() {
        val oldIncompleteTask =
            TaskItem(
                id = 6,
                title = "Trash",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(30),
                category = TaskCategory.OTHER,
            )
        val recentCompletedTask =
            oldIncompleteTask.copy(
                id = 7,
                completed = true,
                completedAt = LocalDateTime.now().minusDays(6),
            )
        val oldCompletedTask =
            oldIncompleteTask.copy(
                id = 8,
                completed = true,
                completedAt = LocalDateTime.now().minusDays(8),
            )
        whenever(taskRepository.findAll()).thenReturn(listOf(oldIncompleteTask, recentCompletedTask, oldCompletedTask))

        operations.deleteExpiredTasks()

        verify(taskHistoryRepository).saveAll(any<List<TaskHistoryEntry>>())
        verify(taskRepository).deleteAll(listOf(oldCompletedTask))
    }

    @Test
    fun `delete task publishes deletion event and realtime update`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(5, "ABC123")).thenReturn(
            TaskItem(
                id = 5,
                title = "Trash",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-04-20"),
                category = TaskCategory.OTHER,
            ),
        )

        operations.deleteTask(5, "Kasper")

        verify(taskRepository).deleteById(5)
        verify(realtimeUpdateService).publish("ABC123", "TASK_DELETED", mapOf("id" to 5L))
    }

    @Test
    fun `give task feedback persists feedback and publishes update`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(13, "ABC123")).thenReturn(
            TaskItem(
                id = 13,
                title = "Bad",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-04-20"),
                category = TaskCategory.CLEANING,
            ),
        )
        val savedFeedback = TaskFeedback(id = 1, taskId = 13, author = "Kasper", message = "Bra jobbet", anonymous = false)
        whenever(taskFeedbackRepository.save(any<TaskFeedback>())).thenReturn(savedFeedback)
        whenever(taskFeedbackRepository.findAllByTaskId(13)).thenReturn(listOf(savedFeedback))

        val result = operations.giveTaskFeedback(13, "Kasper", "Bra jobbet", false, null, null)

        assertEquals(13, result.id)
        assertEquals(1, result.feedbacks.size)
        assertEquals("Kasper", result.feedbacks[0].author)
        assertEquals("Bra jobbet", result.feedbacks[0].message)
        verify(taskFeedbackRepository).save(
            check {
                assertEquals("Bra jobbet", it.message)
                assertEquals("Kasper", it.author)
                assertEquals(false, it.anonymous)
            },
        )
        verify(realtimeUpdateService).publish("ABC123", "TASK_FEEDBACK_UPDATED", result)
    }

    @Test
    fun `give task feedback notifies assignee when actor is different member`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(14, "ABC123")).thenReturn(
            TaskItem(
                id = 14,
                title = "Støvsuge",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-04-20"),
                category = TaskCategory.CLEANING,
            ),
        )
        val savedFeedback = TaskFeedback(id = 2, taskId = 14, author = "Kasper", message = "Ikke grundig nok", anonymous = true)
        whenever(taskFeedbackRepository.save(any<TaskFeedback>())).thenReturn(savedFeedback)
        whenever(taskFeedbackRepository.findAllByTaskId(14)).thenReturn(listOf(savedFeedback))

        val result = operations.giveTaskFeedback(14, "Kasper", "Ikke grundig nok", true, null, null)

        assertEquals(14, result.id)
        assertEquals(1, result.feedbacks.size)
        assertEquals(null, result.feedbacks[0].author) // anonymous — author hidden
        verify(notificationService).createParameterizedNotification(
            userName = "Emma",
            type = "TASK_FEEDBACK",
            params = mapOf("author" to "Someone", "title" to "Støvsuge"),
        )
    }

    @Test
    fun `update task keeps existing recurrence when recurring fields are omitted`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(3, "ABC123")).thenReturn(
            TaskItem(
                id = 3,
                title = "Old",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.parse("2026-04-01"),
                category = TaskCategory.CLEANING,
                xp = 10,
                recurrenceRule = "MONTHLY",
                recurring = true,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(member("Kasper", "kasper@example.com"))
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result =
            operations.updateTask(
                taskId = 3,
                updates = mapOf("title" to "Updated"),
                memberName = "Kasper",
            )

        assertEquals("MONTHLY", result.recurrenceRule)
        verify(taskRepository).save(
            check {
                assertTrue(it.recurring)
            },
        )
    }

    @Test
    fun `toggle task awards full xp when completed on time`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(11, "ABC123")).thenReturn(
            TaskItem(
                id = 11,
                title = "Task",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().plusDays(1),
                category = TaskCategory.OTHER,
                completed = false,
                xpAwarded = false,
                xp = 25,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(
                member("Kasper", "kasper@example.com", xp = 100, level = 1),
                member("Kasper", "kasper@example.com", xp = 125, level = 1),
            )
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        operations.toggleTask(taskId = 11, memberName = "Kasper")

        verify(memberRepository).save(
            check {
                assertEquals(125, it.xp)
            },
        )
    }

    @Test
    fun `toggle task reopens a completed task`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(12, "ABC123")).thenReturn(
            TaskItem(
                id = 12,
                title = "Laundry",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now(),
                category = TaskCategory.OTHER,
                completed = true,
                xpAwarded = true,
                completedBy = "Kasper",
                completedAt = LocalDateTime.parse("2026-04-13T10:00:00"),
                xp = 15,
            ),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result = operations.toggleTask(taskId = 12, memberName = "Kasper")

        assertEquals(false, result.completed)
        verify(taskRepository).save(
            check {
                assertEquals(false, it.completed)
                assertEquals(null, it.completedBy)
                assertEquals(null, it.completedAt)
            },
        )
    }

    @Test
    fun `regret task completes late task with reduced xp and notification`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(14, "ABC123")).thenReturn(
            TaskItem(
                id = 14,
                title = "Bathroom",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(2),
                category = TaskCategory.CLEANING,
                completed = false,
                xpAwarded = false,
                xp = 20,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(member("Kasper", "kasper@example.com", xp = 100, level = 1))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val result = operations.regretTask(taskId = 14, memberName = "Kasper")

        assertEquals(true, result.completed)
        assertEquals(20, result.xp)
        verify(memberRepository).save(
            check {
                assertEquals(110, it.xp)
            },
        )
        verify(notificationService).createParameterizedNotification(
            userName = "Kasper",
            type = "TASK_COMPLETED_LATE",
            params = mapOf("title" to "Bathroom"),
        )
        verify(realtimeUpdateService).publish("ABC123", "TASK_COMPLETED_LATE", result)
    }

    @Test
    fun `penalize missed tasks updates existing penalty difference`() {
        val overdueTask =
            TaskItem(
                id = 18,
                title = "Trash",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now().minusDays(1),
                category = TaskCategory.OTHER,
                xp = 10,
                penaltyXp = -20,
            )
        whenever(taskRepository.findAll()).thenReturn(listOf(overdueTask))
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123"))
            .thenReturn(member("Emma", "emma@example.com", id = 2, xp = 40))

        operations.penalizeMissedTasks()

        verify(memberRepository).save(
            check {
                assertEquals("Emma", it.name)
                assertEquals(50, it.xp)
            },
        )
        verify(taskRepository).save(
            check {
                assertEquals(-10, it.penaltyXp)
            },
        )
    }

    @Test
    fun `regenerate recurring tasks rotates assignments when task count matches member count`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Emma", "emma@example.com", id = 2),
                member("Kasper", "kasper@example.com", id = 1),
            ),
        )
        val storedTasks =
            mutableListOf(
                TaskItem(
                    id = 1,
                    title = "Kitchen",
                    assignee = "Emma",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.now().minusDays(1),
                    category = TaskCategory.CLEANING,
                    xp = 20,
                    recurrenceRule = "WEEKLY",
                    recurring = true,
                ),
                TaskItem(
                    id = 2,
                    title = "Trash",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.now().minusDays(1),
                    category = TaskCategory.OTHER,
                    xp = 10,
                    recurrenceRule = "WEEKLY",
                    recurring = true,
                ),
            )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenAnswer { storedTasks.toList() }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer {
            val task = it.arguments[0] as TaskItem
            val saved = if (task.id == 0L) task.copy(id = (storedTasks.maxOfOrNull(TaskItem::id) ?: 0L) + 1L) else task
            storedTasks.removeAll { existing -> existing.id == saved.id }
            storedTasks += saved
            saved
        }

        operations.regenerateRecurringTasksForCollective("ABC123")

        // Round-robin gives full, fair coverage: the two weekly chores land on the two different
        // members, so over a cycle everyone carries the same load. The exact pairing depends on the
        // week index, so we assert the invariant (complete, distinct coverage) rather than fixed names.
        val rotated = storedTasks.filter { it.dueDate == LocalDate.now().plusDays(6) }
        assertEquals(2, rotated.size)
        assertEquals(setOf("Kitchen", "Trash"), rotated.map { it.title }.toSet())
        assertEquals(setOf("Emma", "Kasper"), rotated.map { it.assignee }.toSet())
    }

    @Test
    fun `regenerate rotates a weekly series to a different member each week`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Emma", "emma@example.com", id = 2),
                member("Kasper", "kasper@example.com", id = 1),
            ),
        )
        // Two consecutive weekly occurrences of the same chore, both currently on Emma.
        val storedTasks =
            mutableListOf(
                TaskItem(
                    id = 1,
                    title = "Kitchen",
                    assignee = "Emma",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.now().plusDays(6),
                    category = TaskCategory.CLEANING,
                    xp = 20,
                    recurrenceRule = "WEEKLY",
                    recurrenceSeriesId = "series-kitchen",
                    recurring = true,
                ),
                TaskItem(
                    id = 2,
                    title = "Kitchen",
                    assignee = "Emma",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.now().plusDays(13),
                    category = TaskCategory.CLEANING,
                    xp = 20,
                    recurrenceRule = "WEEKLY",
                    recurrenceSeriesId = "series-kitchen",
                    recurring = true,
                ),
            )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenAnswer { storedTasks.toList() }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer {
            val task = it.arguments[0] as TaskItem
            val saved = if (task.id == 0L) task.copy(id = (storedTasks.maxOfOrNull(TaskItem::id) ?: 0L) + 1L) else task
            storedTasks.removeAll { existing -> existing.id == saved.id }
            storedTasks += saved
            saved
        }

        operations.regenerateRecurringTasksForCollective("ABC123")

        // The rotation advances exactly one seat per week, so the same chore must move to the other
        // member the following week — guaranteeing equal contribution over a full cycle.
        val week1 = storedTasks.first { it.dueDate == LocalDate.now().plusDays(6) }.assignee
        val week2 = storedTasks.first { it.dueDate == LocalDate.now().plusDays(13) }.assignee
        assertNotEquals(week1, week2)
        assertEquals(setOf("Emma", "Kasper"), setOf(week1, week2))
    }

    @Test
    fun `regenerate recurring tasks catches up missed daily intervals`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", "kasper@example.com")),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(
                    id = 1,
                    title = "Dishes",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.now().minusDays(4),
                    category = TaskCategory.DISHES,
                    xp = 10,
                    recurrenceRule = "DAILY",
                    recurring = true,
                ),
            ),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        operations.regenerateRecurringTasksForCollective("ABC123")

        verify(taskRepository).save(
            check {
                assertEquals("Dishes", it.title)
                assertEquals(LocalDate.now(), it.dueDate)
            },
        )
    }

    @Test
    fun `regenerate recurring tasks does not duplicate a future occurrence`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Kasper", "kasper@example.com")),
        )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                TaskItem(
                    id = 1,
                    title = "Kitchen",
                    assignee = "Kasper",
                    collectiveCode = "ABC123",
                    dueDate = LocalDate.now().plusDays(6),
                    category = TaskCategory.CLEANING,
                    xp = 20,
                    recurrenceRule = "WEEKLY",
                    recurring = true,
                ),
            ),
        )

        operations.regenerateRecurringTasksForCollective("ABC123")

        verify(taskRepository, org.mockito.kotlin.never()).save(any<TaskItem>())
    }

    @Test
    fun `regenerate recurring tasks balances future count and xp across active members`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Emma", "emma@example.com", id = 1),
                member("Kasper", "kasper@example.com", id = 2),
                member("Ola", "ola@example.com", id = 3, status = MemberStatus.AWAY),
            ),
        )
        val dueDate = LocalDate.now().plusDays(3)
        val storedTasks =
            mutableListOf(
                recurringTask(1, "Large", "Ola", dueDate, 100, "large"),
                recurringTask(2, "Medium", "Ola", dueDate, 90, "medium"),
                recurringTask(3, "Small A", "Ola", dueDate, 10, "small-a"),
                recurringTask(4, "Small B", "Ola", dueDate, 10, "small-b"),
            )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenAnswer { storedTasks.toList() }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer {
            val saved = it.arguments[0] as TaskItem
            storedTasks.removeAll { existing -> existing.id == saved.id }
            storedTasks += saved
            saved
        }

        operations.regenerateRecurringTasksForCollective("ABC123")

        val futureTasks = storedTasks.filter { it.dueDate == dueDate }
        assertEquals(setOf("Emma", "Kasper"), futureTasks.map { it.assignee }.toSet())
        assertEquals(listOf(2, 2), futureTasks.groupingBy { it.assignee }.eachCount().values.sorted())
        assertEquals(listOf(100, 110), futureTasks.groupBy { it.assignee }.values.map { tasks -> tasks.sumOf { it.xp } }.sorted())
    }

    @Test
    fun `regenerate recurring tasks keeps same-title recurrence series separate`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Emma", "emma@example.com", id = 1), member("Kasper", "kasper@example.com", id = 2)),
        )
        val storedTasks =
            mutableListOf(
                recurringTask(1, "Kitchen", "Emma", LocalDate.now().minusDays(1), 20, "series-a"),
                recurringTask(2, "Kitchen", "Kasper", LocalDate.now().minusDays(1), 20, "series-b"),
            )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenAnswer { storedTasks.toList() }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer {
            val task = it.arguments[0] as TaskItem
            val saved = if (task.id == 0L) task.copy(id = (storedTasks.maxOfOrNull(TaskItem::id) ?: 0L) + 1L) else task
            storedTasks.removeAll { existing -> existing.id == saved.id }
            storedTasks += saved
            saved
        }

        operations.regenerateRecurringTasksForCollective("ABC123")

        val generated = storedTasks.filter { !it.dueDate.isBefore(LocalDate.now()) }
        assertEquals(2, generated.size)
        assertEquals(setOf("series-a", "series-b"), generated.map { it.recurrenceSeriesId }.toSet())
    }

    @Test
    fun `weekly recurring task continues rotating across all active members`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Emma", "emma@example.com", id = 1),
                member("Kasper", "kasper@example.com", id = 2),
                member("Ola", "ola@example.com", id = 3),
            ),
        )
        val today = LocalDate.now()
        val storedTasks =
            mutableListOf(
                recurringTask(1, "Kitchen", "Emma", today.minusWeeks(3), 20, "kitchen"),
                recurringTask(2, "Kitchen", "Kasper", today.minusWeeks(2), 20, "kitchen"),
                recurringTask(3, "Kitchen", "Ola", today.minusWeeks(1), 20, "kitchen"),
            )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenAnswer { storedTasks.toList() }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer {
            val task = it.arguments[0] as TaskItem
            val saved = if (task.id == 0L) task.copy(id = 4) else task
            storedTasks.removeAll { existing -> existing.id == saved.id }
            storedTasks += saved
            saved
        }

        operations.regenerateRecurringTasksForCollective("ABC123")

        val nextOccurrence = storedTasks.single { it.id == 4L }
        assertEquals(today, nextOccurrence.dueDate)
        assertTrue(setOf("Emma", "Kasper", "Ola").contains(nextOccurrence.assignee))
    }

    @Test
    fun `monthly recurrence remains anchored to the original day after a short month`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Emma", "emma@example.com")),
        )
        val storedTasks =
            mutableListOf(
                recurringTask(1, "Monthly", "Emma", LocalDate.of(2026, 1, 31), 20, "monthly", "MONTHLY"),
                recurringTask(2, "Monthly", "Emma", LocalDate.of(2026, 2, 28), 20, "monthly", "MONTHLY"),
            )
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenAnswer { storedTasks.toList() }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer {
            val task = it.arguments[0] as TaskItem
            val saved = if (task.id == 0L) task.copy(id = 3) else task
            storedTasks.removeAll { existing -> existing.id == saved.id }
            storedTasks += saved
            saved
        }

        operations.regenerateRecurringTasksForCollective("ABC123")

        assertTrue(storedTasks.any { it.id == 3L && it.dueDate == LocalDate.of(2026, 6, 30) })
    }

    private fun recurringTask(
        id: Long,
        title: String,
        assignee: String,
        dueDate: LocalDate,
        xp: Int,
        seriesId: String,
        recurrenceRule: String = "WEEKLY",
    ) = TaskItem(
        id = id,
        title = title,
        assignee = assignee,
        collectiveCode = "ABC123",
        dueDate = dueDate,
        category = TaskCategory.CLEANING,
        xp = xp,
        recurrenceRule = recurrenceRule,
        recurrenceSeriesId = seriesId,
        recurring = true,
    )

    @Test
    fun `nudge notifies the assignee privately`() {
        whenever(taskRepository.findByIdAndCollectiveCode(20, "ABC123")).thenReturn(
            TaskItem(
                id = 20,
                title = "Dishes",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now(),
                category = TaskCategory.OTHER,
                completed = false,
            ),
        )
        whenever(taskFeedbackRepository.findAllByTaskId(20)).thenReturn(emptyList())

        operations.nudgeTask(20, "Kasper")

        verify(notificationService).createParameterizedNotification(
            eq("Emma"),
            eq("TASK_NUDGE"),
            check {
                assertEquals("Kasper", it["sender"])
                assertEquals("Dishes", it["title"])
            },
        )
    }

    @Test
    fun `nudge rejects nudging yourself`() {
        whenever(taskRepository.findByIdAndCollectiveCode(21, "ABC123")).thenReturn(
            TaskItem(
                id = 21,
                title = "Trash",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now(),
                category = TaskCategory.OTHER,
                completed = false,
            ),
        )

        assertThrows<IllegalArgumentException> { operations.nudgeTask(21, "Kasper") }
    }

    @Test
    fun `nudge rejects an already completed task`() {
        whenever(taskRepository.findByIdAndCollectiveCode(22, "ABC123")).thenReturn(
            TaskItem(
                id = 22,
                title = "Done",
                assignee = "Emma",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now(),
                category = TaskCategory.OTHER,
                completed = true,
            ),
        )

        assertThrows<IllegalArgumentException> { operations.nudgeTask(22, "Kasper") }
    }

    @Test
    fun `completing a task stores the proof photo`() {
        whenever(taskRepository.findByIdAndCollectiveCodeForUpdate(30, "ABC123")).thenReturn(
            TaskItem(
                id = 30,
                title = "Bathroom",
                assignee = "Kasper",
                collectiveCode = "ABC123",
                dueDate = LocalDate.now(),
                category = TaskCategory.OTHER,
                completed = false,
                xpAwarded = false,
                xp = 10,
            ),
        )
        whenever(memberRepository.findByNameAndCollectiveCode("Kasper", "ABC123"))
            .thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        val done = operations.toggleTask(30, "Kasper", "BASE64DATA", "image/png")

        assertEquals("BASE64DATA", done.completionImageData)
        assertEquals("image/png", done.completionImageMime)
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String? = "ABC123",
        xp: Int = 0,
        level: Int = 1,
        status: MemberStatus = MemberStatus.ACTIVE,
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
        xp = xp,
        level = level,
        status = status,
    )
}
