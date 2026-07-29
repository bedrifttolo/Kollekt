package com.kollekt.service

import com.kollekt.api.dto.PaymentHandlesDto
import com.kollekt.api.dto.UpdatePaymentHandlesRequest
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import com.kollekt.domain.TaskItem
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.FriendshipRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.check
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDate

class MemberOperationsTest {
    private lateinit var memberRepository: MemberRepository
    private lateinit var friendshipRepository: FriendshipRepository
    private lateinit var taskRepository: TaskRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var taskOperations: TaskOperations
    private lateinit var userProfileService: UserProfileService
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var operations: MemberOperations

    @BeforeEach
    fun setUp() {
        memberRepository = mock()
        friendshipRepository = mock()
        taskRepository = mock()
        collectiveRepository = mock()
        taskOperations = mock()
        userProfileService = UserProfileService(memberRepository, friendshipRepository)
        collectiveAccessService = CollectiveAccessService(memberRepository, collectiveRepository)
        operations =
            MemberOperations(
                memberRepository,
                taskRepository,
                taskOperations,
                userProfileService,
                collectiveAccessService,
            )
    }

    @Test
    fun `leave collective redistributes incomplete tasks to least loaded member`() {
        val kasper = member("Kasper", "kasper@example.com")
        val emma = member("Emma", "emma@example.com", id = 2)
        val ola = member("Ola", "ola@example.com", id = 3)
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(listOf(kasper, emma, ola))
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                task(id = 1, title = "Trash", assignee = "Kasper", xp = 20),
                task(id = 2, title = "Floors", assignee = "Emma", xp = 30),
            ),
        )
        whenever(taskRepository.save(any<TaskItem>())).thenAnswer { it.arguments[0] as TaskItem }

        operations.leaveCollective("Kasper")

        verify(memberRepository).save(kasper.copy(collectiveCode = null))
        verify(taskRepository).save(
            check {
                assertEquals(1L, it.id)
                assertEquals("Ola", it.assignee)
            },
        )
    }

    @Test
    fun `delete user removes member and redistributes open tasks`() {
        val kasper = member("Kasper", "kasper@example.com")
        val emma = member("Emma", "emma@example.com", id = 2)
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(listOf(emma))
        whenever(taskRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(task(id = 1, title = "Trash", assignee = "Kasper", xp = 20)),
        )

        operations.deleteUser("Kasper")

        verify(memberRepository).delete(kasper)
        verify(taskRepository).save(
            check {
                assertEquals(1L, it.id)
                assertEquals("Emma", it.assignee)
            },
        )
    }

    @Test
    fun `leave collective does nothing when member has no collective`() {
        val kasper = member("Kasper", "kasper@example.com", collectiveCode = null)
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)

        operations.leaveCollective("Kasper")

        verify(memberRepository, never()).save(any())
        verify(taskRepository, never()).findAllByCollectiveCode(any())
    }

    @Test
    fun `update member color trims and saves a valid hex color`() {
        val kasper = member("Kasper", "kasper@example.com")
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)

        operations.updateMemberColor("Kasper", "  #1f563F  ")

        verify(memberRepository).save(kasper.copy(color = "#1f563F"))
    }

    @Test
    fun `update member color rejects invalid values and missing members`() {
        val kasper = member("Kasper", "kasper@example.com")
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)
        whenever(memberRepository.findByName("Missing")).thenReturn(null)

        assertThrows(IllegalArgumentException::class.java) {
            operations.updateMemberColor("Kasper", "pine")
        }
        assertThrows(IllegalArgumentException::class.java) {
            operations.updateMemberColor("Missing", "#1f563f")
        }

        verify(memberRepository, never()).save(any())
    }

    @Test
    fun `update member status triggers task regeneration only on actual change`() {
        val kasper = member("Kasper", "kasper@example.com").copy(status = MemberStatus.ACTIVE)
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)

        operations.updateMemberStatus("Kasper", MemberStatus.AWAY)

        verify(memberRepository).save(kasper.copy(status = MemberStatus.AWAY))
        verify(taskOperations).regenerateRecurringTasksForCollective("ABC123")
    }

    @Test
    fun `returning active triggers recurring task redistribution`() {
        val kasper = member("Kasper", "kasper@example.com").copy(status = MemberStatus.AWAY)
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)

        operations.updateMemberStatus("Kasper", MemberStatus.ACTIVE)

        verify(memberRepository).save(kasper.copy(status = MemberStatus.ACTIVE))
        verify(taskOperations).regenerateRecurringTasksForCollective("ABC123")
    }

    @Test
    fun `get collective members sorts by name before mapping`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Ola", "ola@example.com", id = 3),
                member("Emma", "emma@example.com", id = 2),
            ),
        )

        val result = operations.getCollectiveMembers("Kasper")

        assertEquals(listOf("Emma", "Ola"), result.map { it.name })
    }

    @Test
    fun `add and remove friend delegates to persistent profile state`() {
        whenever(memberRepository.findByName("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
        whenever(memberRepository.findByName("Emma")).thenReturn(member("Emma", "emma@example.com", id = 2))
        whenever(friendshipRepository.deleteByMemberIdAndFriendId(1, 2)).thenReturn(1)

        operations.addFriend("Kasper", "Emma")
        operations.removeFriend("Kasper", "Emma")

        verify(friendshipRepository).save(
            check { friendship ->
                assertEquals(1, friendship.memberId)
                assertEquals(2, friendship.friendId)
            },
        )
        verify(friendshipRepository).deleteByMemberIdAndFriendId(1, 2)
    }

    @Test
    fun `away with a date stores awayUntil and regenerates rotation`() {
        val kasper = member("Kasper", "kasper@example.com").copy(status = MemberStatus.ACTIVE)
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)
        val until = LocalDate.now().plusDays(7)

        operations.updateMemberStatus("Kasper", MemberStatus.AWAY, until)

        verify(memberRepository).save(kasper.copy(status = MemberStatus.AWAY, awayUntil = until))
        verify(taskOperations).regenerateRecurringTasksForCollective("ABC123")
    }

    @Test
    fun `returning active clears any away date`() {
        val away = member("Kasper", "kasper@example.com").copy(status = MemberStatus.AWAY, awayUntil = LocalDate.now().plusDays(2))
        whenever(memberRepository.findByName("Kasper")).thenReturn(away)

        operations.updateMemberStatus("Kasper", MemberStatus.ACTIVE)

        verify(memberRepository).save(away.copy(status = MemberStatus.ACTIVE, awayUntil = null))
    }

    @Test
    fun `away date in the past is rejected`() {
        val kasper = member("Kasper", "kasper@example.com")
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)

        assertThrows(IllegalArgumentException::class.java) {
            operations.updateMemberStatus("Kasper", MemberStatus.AWAY, LocalDate.now().minusDays(1))
        }
        verify(memberRepository, never()).save(any())
    }

    @Test
    fun `resume expired away members reactivates only those past their date`() {
        val expired =
            member("Kasper", "kasper@example.com")
                .copy(status = MemberStatus.AWAY, awayUntil = LocalDate.now().minusDays(1))
        val stillAway =
            member("Emma", "emma@example.com", id = 2)
                .copy(status = MemberStatus.AWAY, awayUntil = LocalDate.now().plusDays(3))
        whenever(memberRepository.findAll()).thenReturn(listOf(expired, stillAway))
        whenever(memberRepository.save(any<Member>())).thenAnswer { it.arguments[0] as Member }

        operations.resumeExpiredAwayMembers()

        verify(memberRepository).save(expired.copy(status = MemberStatus.ACTIVE, awayUntil = null))
        verify(memberRepository, never()).save(stillAway.copy(status = MemberStatus.ACTIVE, awayUntil = null))
        verify(taskOperations).regenerateRecurringTasksForCollective("ABC123")
    }

    @Test
    fun `get payment handles returns the stored handles`() {
        val kasper =
            member("Kasper", "kasper@example.com")
                .copy(
                    vippsHandle = "+4791234567",
                    mobilepayHandle = "12345678",
                    paypalHandle = "kasper",
                    bankAccount = "NO9386011117947",
                )
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)

        val result = operations.getPaymentHandles("Kasper")

        assertEquals("+4791234567", result.vipps)
        assertEquals("12345678", result.mobilepay)
        assertEquals("kasper", result.paypal)
        assertEquals("NO9386011117947", result.bankAccount)
    }

    @Test
    fun `get payment handles rejects an unknown member`() {
        whenever(memberRepository.findByName("Missing")).thenReturn(null)

        assertThrows(IllegalArgumentException::class.java) {
            operations.getPaymentHandles("Missing")
        }
    }

    @Test
    fun `update payment handles strips formatting before saving`() {
        val kasper = member("Kasper", "kasper@example.com")
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)

        val result =
            operations.updatePaymentHandles(
                UpdatePaymentHandlesRequest(
                    memberName = "Kasper",
                    vipps = "+47 912 34 567",
                    mobilepay = "12-34-56-78",
                    // Both the full URL and a bare @handle are things people paste in.
                    paypal = "https://paypal.me/@Kasper",
                    bankAccount = "no93 8601 1117 947",
                ),
            )

        assertEquals("+4791234567", result.vipps)
        assertEquals("12345678", result.mobilepay)
        assertEquals("Kasper", result.paypal)
        // IBANs are stored upper-cased so settle-up links compare equal regardless of entry.
        assertEquals("NO9386011117947", result.bankAccount)
        verify(memberRepository).save(
            kasper.copy(
                vippsHandle = "+4791234567",
                mobilepayHandle = "12345678",
                paypalHandle = "Kasper",
                bankAccount = "NO9386011117947",
            ),
        )
    }

    @Test
    fun `blank payment handles clear the stored value`() {
        val kasper =
            member("Kasper", "kasper@example.com")
                .copy(vippsHandle = "+4791234567", paypalHandle = "kasper")
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)

        val result =
            operations.updatePaymentHandles(
                UpdatePaymentHandlesRequest(memberName = "Kasper", vipps = "   ", paypal = ""),
            )

        assertEquals(PaymentHandlesDto(), result)
        verify(memberRepository).save(
            kasper.copy(vippsHandle = null, mobilepayHandle = null, paypalHandle = null, bankAccount = null),
        )
    }

    @Test
    fun `malformed payment handles are rejected without saving`() {
        val kasper = member("Kasper", "kasper@example.com")
        whenever(memberRepository.findByName("Kasper")).thenReturn(kasper)
        whenever(memberRepository.findByName("Missing")).thenReturn(null)

        // Too short for a phone number.
        assertThrows(IllegalArgumentException::class.java) {
            operations.updatePaymentHandles(UpdatePaymentHandlesRequest("Kasper", vipps = "12345"))
        }
        // Letters are not a phone number.
        assertThrows(IllegalArgumentException::class.java) {
            operations.updatePaymentHandles(UpdatePaymentHandlesRequest("Kasper", mobilepay = "not-a-number"))
        }
        // PayPal.Me handles are alphanumeric only.
        assertThrows(IllegalArgumentException::class.java) {
            operations.updatePaymentHandles(UpdatePaymentHandlesRequest("Kasper", paypal = "kasper!"))
        }
        // Below the 6-character IBAN floor.
        assertThrows(IllegalArgumentException::class.java) {
            operations.updatePaymentHandles(UpdatePaymentHandlesRequest("Kasper", bankAccount = "NO93"))
        }
        assertThrows(IllegalArgumentException::class.java) {
            operations.updatePaymentHandles(UpdatePaymentHandlesRequest("Missing", vipps = "+4791234567"))
        }

        verify(memberRepository, never()).save(any())
    }

    private fun member(
        name: String,
        email: String,
        id: Long = 1,
        collectiveCode: String? = "ABC123",
    ) = Member(
        id = id,
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )

    private fun task(
        id: Long,
        title: String,
        assignee: String,
        xp: Int,
    ) = TaskItem(
        id = id,
        title = title,
        assignee = assignee,
        collectiveCode = "ABC123",
        dueDate = LocalDate.now().plusDays(1),
        category = TaskCategory.CLEANING,
        xp = xp,
    )
}
