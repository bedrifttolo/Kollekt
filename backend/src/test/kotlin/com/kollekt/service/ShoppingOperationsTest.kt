package com.kollekt.service

import com.kollekt.api.dto.CreateExpenseRequest
import com.kollekt.api.dto.CreateShoppingItemRequest
import com.kollekt.api.dto.MarkSupplyBoughtRequest
import com.kollekt.api.dto.UpdateShoppingItemRequest
import com.kollekt.domain.Member
import com.kollekt.domain.ShoppingItem
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.ShoppingItemRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.LocalDate
import java.time.LocalDateTime

class ShoppingOperationsTest {
    private lateinit var shoppingItemRepository: ShoppingItemRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var notificationService: NotificationService
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var currentMemberContext: CurrentMemberContext
    private lateinit var economyOperations: EconomyOperations
    private lateinit var operations: ShoppingOperations

    @BeforeEach
    fun setUp() {
        shoppingItemRepository = mock()
        memberRepository = mock()
        collectiveRepository = mock()
        notificationService = mock()
        currentMemberContext = mock()
        collectiveAccessService = CollectiveAccessService(currentMemberContext, collectiveRepository)
        economyOperations = mock()
        operations =
            ShoppingOperations(
                shoppingItemRepository,
                memberRepository,
                notificationService,
                collectiveAccessService,
                economyOperations,
            )
        whenever(currentMemberContext.current("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
    }

    @Test
    fun `get shopping items maps collective scoped results`() {
        whenever(shoppingItemRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                ShoppingItem(id = 1, item = "Milk", addedBy = "Emma", collectiveCode = "ABC123", completed = false),
                ShoppingItem(id = 2, item = "Soap", addedBy = "Kasper", collectiveCode = "ABC123", completed = true),
            ),
        )

        val result = operations.getShoppingItems("Kasper")

        assertEquals(listOf("Milk", "Soap"), result.map { it.item })
        assertEquals(listOf(false, true), result.map { it.completed })
    }

    @Test
    fun `create shopping item uses actor scoped collective and publishes event`() {
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result =
            operations.createShoppingItem(
                request = CreateShoppingItemRequest(item = "  Bread  ", addedBy = "Ignored"),
                actorName = "Kasper",
            )

        assertEquals("Bread", result.item)
        assertEquals("Kasper", result.addedBy)
    }

    @Test
    fun `create shopping item rejects blank input`() {
        val error =
            assertThrows<IllegalArgumentException> {
                operations.createShoppingItem(CreateShoppingItemRequest("   ", "Ignored"), "Kasper")
            }

        assertEquals("Shopping item is required", error.message)
    }

    @Test
    fun `toggle shopping item flips completion and publishes update`() {
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(9, "ABC123")).thenReturn(
            ShoppingItem(id = 9, item = "Milk", addedBy = "Emma", collectiveCode = "ABC123", completed = false),
        )
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result = operations.toggleShoppingItem(9, "Kasper")

        assertTrue(result.completed)
    }

    @Test
    fun `toggle from completed to incomplete sets completedAt to null`() {
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(9, "ABC123")).thenReturn(
            ShoppingItem(
                id = 9,
                item = "Milk",
                addedBy = "Emma",
                collectiveCode = "ABC123",
                completed = true,
                completedAt = LocalDateTime.now(),
            ),
        )
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result = operations.toggleShoppingItem(9, "Kasper")

        assertFalse(result.completed)
    }

    @Test
    fun `delete shopping item removes item and publishes event`() {
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(5, "ABC123")).thenReturn(
            ShoppingItem(id = 5, item = "Bread", addedBy = "Kasper", collectiveCode = "ABC123", completed = false),
        )

        operations.deleteShoppingItem(5, "Kasper")

        verify(shoppingItemRepository).deleteById(5)
    }

    @Test
    fun `update shopping item saves new name and publishes event`() {
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(3, "ABC123")).thenReturn(
            ShoppingItem(id = 3, item = "Old item", addedBy = "Kasper", collectiveCode = "ABC123", completed = false),
        )
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result = operations.updateShoppingItem(3, UpdateShoppingItemRequest(item = "New item"), "Kasper")

        assertEquals("New item", result.item)
    }

    @Test
    fun `cleanup deletes items completed more than one day ago`() {
        val old =
            ShoppingItem(
                id = 1,
                item = "Milk",
                addedBy = "Kasper",
                collectiveCode = "ABC123",
                completed = true,
                completedAt = LocalDateTime.now().minusDays(2),
            )
        val recent =
            ShoppingItem(
                id = 2,
                item = "Bread",
                addedBy = "Kasper",
                collectiveCode = "ABC123",
                completed = true,
                completedAt = LocalDateTime.now(),
            )
        val incomplete = ShoppingItem(id = 3, item = "Eggs", addedBy = "Kasper", collectiveCode = "ABC123", completed = false)
        whenever(shoppingItemRepository.findAll()).thenReturn(listOf(old, recent, incomplete))

        operations.cleanupBoughtItems()

        verify(shoppingItemRepository).deleteById(1)
        verify(shoppingItemRepository, never()).deleteById(2)
        verify(shoppingItemRepository, never()).deleteById(3)
    }

    @Test
    fun `create shopping item flags communal staple`() {
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        val result =
            operations.createShoppingItem(
                request = CreateShoppingItemRequest(item = "Toilet paper", addedBy = "Ignored", staple = true),
                actorName = "Kasper",
            )

        assertTrue(result.staple)
    }

    @Test
    fun `mark supply bought creates expense under chosen category`() {
        whenever(shoppingItemRepository.findByIdAndCollectiveCode(9, "ABC123")).thenReturn(
            ShoppingItem(id = 9, item = "Lightbulbs", addedBy = "Kasper", collectiveCode = "ABC123", completed = false),
        )
        whenever(shoppingItemRepository.save(any<ShoppingItem>())).thenAnswer { it.arguments[0] as ShoppingItem }

        operations.markSupplyBought(
            itemId = 9,
            request =
                MarkSupplyBoughtRequest(
                    amount = 50,
                    paidBy = "Kasper",
                    participantNames = listOf("Kasper"),
                    date = LocalDate.now(),
                    category = "Other",
                ),
            memberName = "Kasper",
        )

        val captor = argumentCaptor<CreateExpenseRequest>()
        verify(economyOperations).createExpense(captor.capture(), any())
        assertEquals("Other", captor.firstValue.category)
    }

    private fun member(
        name: String,
        email: String,
        collectiveCode: String? = "ABC123",
    ) = Member(
        name = name,
        email = email,
        collectiveCode = collectiveCode,
    )
}
