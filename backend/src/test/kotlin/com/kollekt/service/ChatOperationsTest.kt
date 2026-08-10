package com.kollekt.service

import com.kollekt.api.dto.CreateMessageRequest
import com.kollekt.api.dto.CreatePollRequest
import com.kollekt.domain.ChatMessage
import com.kollekt.domain.Collective
import com.kollekt.domain.Member
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.ChatMessageRepository
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.mock.web.MockMultipartFile
import java.time.LocalDateTime
import java.util.Base64
import java.util.Optional

class ChatOperationsTest {
    private lateinit var chatMessageRepository: ChatMessageRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveRepository: CollectiveRepository
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var notificationService: NotificationService
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var currentMemberContext: CurrentMemberContext
    private lateinit var imageSafetyService: ImageSafetyService
    private lateinit var operations: ChatOperations

    @BeforeEach
    fun setUp() {
        chatMessageRepository = mock()
        memberRepository = mock()
        collectiveRepository = mock()
        realtimeUpdateService = mock()
        notificationService = mock()
        currentMemberContext = mock()
        imageSafetyService = mock()
        collectiveAccessService = CollectiveAccessService(currentMemberContext, collectiveRepository)
        operations =
            ChatOperations(
                chatMessageRepository,
                memberRepository,
                realtimeUpdateService,
                notificationService,
                collectiveAccessService,
                imageSafetyService,
            )
        whenever(currentMemberContext.current("Kasper")).thenReturn(member("Kasper", "kasper@example.com"))
    }

    @Test
    fun `create message trims text and publishes realtime event`() {
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 11)
        }

        val result = operations.createMessage(CreateMessageRequest(sender = "Ignored", text = "  Hei kollektiv  "), "Kasper")

        assertEquals("Hei kollektiv", result.text)
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_CREATED", result)
    }

    @Test
    fun `create image message stores base64 payload`() {
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 15)
        }
        val image = MockMultipartFile("image", "cleanup.png", "image/png", "img".toByteArray())

        val result = operations.createImageMessage(image, "  Finished  ", "Kasper")

        assertEquals("Finished", result.text)
        assertEquals(Base64.getEncoder().encodeToString("img".toByteArray()), result.imageData)
    }

    @Test
    fun `create image message rejects an image flagged by moderation and never persists it`() {
        val image = MockMultipartFile("image", "flagged.png", "image/png", "img".toByteArray())
        whenever(imageSafetyService.validateAndModerate(any(), any())).thenThrow(ImageRejectedException())

        assertThrows(ImageRejectedException::class.java) {
            operations.createImageMessage(image, null, "Kasper")
        }

        verify(chatMessageRepository, never()).save(any<ChatMessage>())
    }

    @Test
    fun `create message allows replying to a reply`() {
        whenever(chatMessageRepository.findById(7)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 7,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Reply",
                    timestamp = LocalDateTime.now(),
                    replyToMessageId = 3,
                ),
            ),
        )
        whenever(chatMessageRepository.existsByReplyToMessageId(7)).thenReturn(false)
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 12)
        }

        val result =
            operations.createMessage(
                CreateMessageRequest(sender = "Ignored", text = "Nested reply", replyToMessageId = 7),
                "Kasper",
            )

        assertEquals(7, result.replyToMessageId)
    }

    @Test
    fun `create message rejects second direct reply to same message`() {
        whenever(chatMessageRepository.findById(5)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 5,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Original",
                    timestamp = LocalDateTime.now(),
                ),
            ),
        )
        whenever(chatMessageRepository.existsByReplyToMessageId(5)).thenReturn(true)

        val error =
            assertThrows(IllegalArgumentException::class.java) {
                operations.createMessage(
                    CreateMessageRequest(sender = "Ignored", text = "Another reply", replyToMessageId = 5),
                    "Kasper",
                )
            }

        assertEquals("Message already has a reply", error.message)
    }

    @Test
    fun `add reaction replaces actor previous reaction`() {
        whenever(chatMessageRepository.findById(9)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 9,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Hi",
                    timestamp = LocalDateTime.now(),
                    reactions = """{"❤️":["Kasper"],"👍":["Emma"]}""",
                ),
            ),
        )
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = operations.addReaction(9, "🔥", "Kasper")

        assertEquals(listOf("Emma"), result.reactions.single { it.emoji == "👍" }.users)
        assertEquals(listOf("Kasper"), result.reactions.single { it.emoji == "🔥" }.users)
        assertNull(result.reactions.find { it.emoji == "❤️" })
    }

    @Test
    fun `vote poll moves actor vote between options`() {
        whenever(chatMessageRepository.findById(15)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 15,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Poll",
                    timestamp = LocalDateTime.now(),
                    poll =
                        """
                        {"question":"Favorite snack?","options":[
                          {"id":0,"text":"Chips","users":["Emma","Kasper"]},
                          {"id":1,"text":"Soda","users":[]}
                        ]}
                        """.trimIndent(),
                ),
            ),
        )
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = operations.votePoll(15, 1, "Kasper")

        assertTrue(
            result.poll!!
                .options
                .single { it.id == 0 }
                .users
                .none { it == "Kasper" },
        )
        assertEquals(
            listOf("Kasper"),
            result.poll!!
                .options
                .single { it.id == 1 }
                .users,
        )
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_POLL_UPDATED", result)
    }

    @Test
    fun `pinning a message unpins any previously pinned message`() {
        val target =
            ChatMessage(
                id = 50,
                sender = "Emma",
                collectiveCode = "ABC123",
                text = "Landlord visit Friday",
                timestamp = LocalDateTime.now(),
            )
        val previouslyPinned =
            ChatMessage(
                id = 49,
                sender = "Ola",
                collectiveCode = "ABC123",
                text = "Old notice",
                timestamp = LocalDateTime.now(),
                pinned = true,
            )
        whenever(chatMessageRepository.findById(50)).thenReturn(Optional.of(target))
        whenever(chatMessageRepository.findAllByCollectiveCode("ABC123")).thenReturn(listOf(target, previouslyPinned))
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = operations.togglePin(50, "Kasper")

        assertTrue(result.pinned)
        verify(chatMessageRepository).save(previouslyPinned.copy(pinned = false))
        verify(chatMessageRepository).save(target.copy(pinned = true))
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("MESSAGE_PINNED"), any())
    }

    @Test
    fun `pinning an already pinned message unpins it`() {
        val pinned =
            ChatMessage(
                id = 51,
                sender = "Emma",
                collectiveCode = "ABC123",
                text = "Notice",
                timestamp = LocalDateTime.now(),
                pinned = true,
            )
        whenever(chatMessageRepository.findById(51)).thenReturn(Optional.of(pinned))
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = operations.togglePin(51, "Kasper")

        assertEquals(false, result.pinned)
        verify(chatMessageRepository).save(pinned.copy(pinned = false))
    }

    @Test
    fun `post household notice saves message and publishes without notifying members`() {
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 21)
        }

        val result = operations.postHouseholdNotice("ABC123", "Kasper", "Quiet hours please")

        assertEquals(21L, result.id)
        assertEquals("Kasper", result.sender)
        assertEquals("Quiet hours please", result.text)
        verify(realtimeUpdateService).publish(eq("ABC123"), eq("MESSAGE_CREATED"), any())
        verify(notificationService, never()).createParameterizedGroupNotification(any(), any(), any())
    }

    @Test
    fun `get messages returns only household messages`() {
        whenever(chatMessageRepository.findAllByCollectiveCodeAndRecipientIsNull("ABC123")).thenReturn(
            listOf(ChatMessage(id = 1, sender = "Emma", collectiveCode = "ABC123", text = "Hi all", timestamp = LocalDateTime.now())),
        )

        val result = operations.getMessages("Kasper")

        assertEquals(1, result.size)
        assertEquals("Hi all", result.single().text)
        assertNull(result.single().recipient)
    }

    @Test
    fun `create direct message targets only the two participants and never the household`() {
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123")).thenReturn(member("Emma", "emma@example.com"))
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 30)
        }

        val result = operations.createDirectMessage("Emma", "  psst  ", "Kasper")

        assertEquals("psst", result.text)
        assertEquals("Emma", result.recipient)
        verify(realtimeUpdateService).publishToMembers("ABC123", setOf("Kasper", "Emma"), "DIRECT_MESSAGE_CREATED", result)
        verify(realtimeUpdateService, never()).publish(any(), any(), any())
        verify(notificationService).createParameterizedGroupNotification(eq(listOf("Emma")), eq("NEW_MESSAGE"), any())
    }

    @Test
    fun `create direct message rejects a recipient outside the collective`() {
        whenever(memberRepository.findByNameAndCollectiveCode("Stranger", "ABC123")).thenReturn(null)

        val error =
            assertThrows(IllegalArgumentException::class.java) {
                operations.createDirectMessage("Stranger", "hi", "Kasper")
            }

        assertEquals("Member 'Stranger' is not in your collective", error.message)
        verify(chatMessageRepository, never()).save(any<ChatMessage>())
    }

    @Test
    fun `create direct message rejects sending to yourself`() {
        assertThrows(IllegalArgumentException::class.java) {
            operations.createDirectMessage("Kasper", "note to self", "Kasper")
        }
    }

    @Test
    fun `create direct message rejects blank text`() {
        assertThrows(IllegalArgumentException::class.java) {
            operations.createDirectMessage("Emma", "   ", "Kasper")
        }
    }

    @Test
    fun `get direct messages returns the pair thread`() {
        whenever(memberRepository.findByNameAndCollectiveCode("Emma", "ABC123")).thenReturn(member("Emma", "emma@example.com"))
        whenever(chatMessageRepository.findDirectThread("ABC123", "Kasper", "Emma")).thenReturn(
            listOf(
                ChatMessage(
                    id = 40,
                    sender = "Emma",
                    recipient = "Kasper",
                    collectiveCode = "ABC123",
                    text = "private",
                    timestamp = LocalDateTime.now(),
                ),
            ),
        )

        val result = operations.getDirectMessages("Kasper", "Emma")

        assertEquals(1, result.size)
        assertEquals("private", result.single().text)
        assertEquals("Kasper", result.single().recipient)
    }

    @Test
    fun `get direct messages rejects opening a thread with yourself`() {
        assertThrows(IllegalArgumentException::class.java) {
            operations.getDirectMessages("Kasper", "Kasper")
        }
    }

    @Test
    fun `reactions on direct messages are blocked for non-participants so they never broadcast`() {
        // Kasper (the recipient) may react — only a third party outside the pair should be denied,
        // since allowing that would leak the DM's existence to the rest of the household.
        whenever(currentMemberContext.current("Ola")).thenReturn(member("Ola", "ola@example.com"))
        whenever(chatMessageRepository.findById(60)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 60,
                    sender = "Emma",
                    recipient = "Kasper",
                    collectiveCode = "ABC123",
                    text = "dm",
                    timestamp = LocalDateTime.now(),
                ),
            ),
        )

        val error =
            assertThrows(IllegalArgumentException::class.java) {
                operations.addReaction(60, "🔥", "Ola")
            }

        assertEquals("Message not found", error.message)
        verify(realtimeUpdateService, never()).publish(any(), any(), any())
    }

    @Test
    fun `thread summaries list the household plus one row per DM thread, newest activity first`() {
        whenever(collectiveRepository.findByJoinCode("ABC123"))
            .thenReturn(Collective(name = "Kollektiv Cool", joinCode = "ABC123", ownerMemberId = 1))
        val household =
            ChatMessage(
                id = 1,
                sender = "Emma",
                collectiveCode = "ABC123",
                text = "x".repeat(80),
                timestamp = LocalDateTime.now().minusHours(1),
            )
        whenever(chatMessageRepository.findTopByCollectiveCodeAndRecipientIsNullOrderByTimestampDesc("ABC123"))
            .thenReturn(household)
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(
                member("Emma", "emma@example.com"),
                member("Kasper", "kasper@example.com"),
                member("Ola", "ola@example.com").copy(status = MemberStatus.LEFT),
                member("Nils", "nils@example.com"),
            ),
        )
        val emmaDm =
            ChatMessage(
                id = 2,
                sender = "Emma",
                recipient = "Kasper",
                collectiveCode = "ABC123",
                text = "hey",
                timestamp = LocalDateTime.now().minusMinutes(30),
            )
        val systemDm =
            ChatMessage(
                id = 3,
                sender = ChatOperations.SYSTEM_SENDER,
                recipient = "Kasper",
                collectiveCode = "ABC123",
                text = "notice",
                timestamp = LocalDateTime.now().minusMinutes(10),
            )
        whenever(chatMessageRepository.findAllDirectMessagesInvolving("ABC123", "Kasper"))
            .thenReturn(listOf(emmaDm, systemDm))

        val result = operations.getThreadSummaries("Kasper")

        assertEquals(4, result.size)
        assertNull(result[0].thread)
        assertEquals("Kollektiv Cool", result[0].displayName)
        assertEquals(household.id, result[0].lastMessageId)
        assertTrue(result[0].lastMessagePreview!!.endsWith("..."))
        assertEquals(ChatOperations.SYSTEM_SENDER, result[1].thread)
        assertTrue(result[1].isSystem)
        assertEquals("Emma", result[2].thread)
        assertFalse(result[2].isSystem)
        assertEquals("Nils", result[3].thread)
        assertNull(result[3].lastMessageTimestamp)
    }

    @Test
    fun `remove reaction drops the emoji entirely once its last voter is removed`() {
        whenever(chatMessageRepository.findById(70)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 70,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "hi",
                    timestamp = LocalDateTime.now(),
                    reactions = """{"🔥":["Kasper"]}""",
                ),
            ),
        )
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = operations.removeReaction(70, "🔥", "Kasper")

        assertTrue(result.reactions.isEmpty())
    }

    @Test
    fun `remove reaction keeps other voters on the same emoji`() {
        whenever(chatMessageRepository.findById(71)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 71,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "hi",
                    timestamp = LocalDateTime.now(),
                    reactions = """{"❤️":["Kasper","Emma"]}""",
                ),
            ),
        )
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer { it.arguments[0] as ChatMessage }

        val result = operations.removeReaction(71, "❤️", "Kasper")

        assertEquals(listOf("Emma"), result.reactions.single { it.emoji == "❤️" }.users)
    }

    @Test
    fun `create poll trims, dedupes options and notifies other active members`() {
        whenever(memberRepository.findAllByCollectiveCode("ABC123")).thenReturn(
            listOf(member("Emma", "emma@example.com"), member("Ola", "ola@example.com").copy(status = MemberStatus.LEFT)),
        )
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 80)
        }

        val result =
            operations.createPoll(
                CreatePollRequest(question = " Pizza or tacos? ", options = listOf(" Pizza ", "Tacos", "Pizza", " ")),
                "Kasper",
            )

        assertEquals("Pizza or tacos?", result.poll!!.question)
        assertEquals(listOf("Pizza", "Tacos"), result.poll!!.options.map { it.text })
        assertEquals("📊 Pizza or tacos?", result.text)
        verify(realtimeUpdateService).publish("ABC123", "MESSAGE_CREATED", result)
        verify(notificationService).createParameterizedGroupNotification(eq(listOf("Emma")), eq("NEW_MESSAGE"), any())
    }

    @Test
    fun `create poll rejects fewer than two unique options`() {
        assertThrows(IllegalArgumentException::class.java) {
            operations.createPoll(CreatePollRequest(question = "Snack?", options = listOf("Chips", "Chips")), "Kasper")
        }
    }

    @Test
    fun `vote poll rejects an option id that does not exist`() {
        whenever(chatMessageRepository.findById(90)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 90,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Poll",
                    timestamp = LocalDateTime.now(),
                    poll = """{"question":"Snack?","options":[{"id":0,"text":"Chips","users":[]}]}""",
                ),
            ),
        )

        val error =
            assertThrows(IllegalArgumentException::class.java) {
                operations.votePoll(90, 5, "Kasper")
            }

        assertEquals("Invalid poll option", error.message)
    }

    @Test
    fun `vote poll rejects a message that is not a poll`() {
        whenever(chatMessageRepository.findById(91)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 91,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "Not a poll",
                    timestamp = LocalDateTime.now(),
                ),
            ),
        )

        val error =
            assertThrows(IllegalArgumentException::class.java) {
                operations.votePoll(91, 0, "Kasper")
            }

        assertEquals("Message is not a poll", error.message)
    }

    @Test
    fun `toggle pin rejects a message from another collective`() {
        whenever(chatMessageRepository.findById(95)).thenReturn(
            Optional.of(
                ChatMessage(
                    id = 95,
                    sender = "Emma",
                    collectiveCode = "OTHER",
                    text = "elsewhere",
                    timestamp = LocalDateTime.now(),
                ),
            ),
        )

        val error =
            assertThrows(IllegalArgumentException::class.java) {
                operations.togglePin(95, "Kasper")
            }

        assertEquals("Message not found", error.message)
    }

    @Test
    fun `post direct notice targets only the recipient and sends no notification`() {
        whenever(chatMessageRepository.save(any<ChatMessage>())).thenAnswer {
            (it.arguments[0] as ChatMessage).copy(id = 96)
        }

        val result = operations.postDirectNotice("ABC123", "Emma", ChatOperations.SYSTEM_SENDER, "Violation reported")

        assertEquals("Emma", result.recipient)
        assertEquals(ChatOperations.SYSTEM_SENDER, result.sender)
        verify(realtimeUpdateService).publishToMembers("ABC123", setOf("Emma"), "DIRECT_MESSAGE_CREATED", result)
        verify(notificationService, never()).createParameterizedGroupNotification(any(), any(), any())
    }

    @Test
    fun `get messages tolerates malformed reaction and poll payloads`() {
        whenever(chatMessageRepository.findAllByCollectiveCodeAndRecipientIsNull("ABC123")).thenReturn(
            listOf(
                ChatMessage(
                    id = 97,
                    sender = "Emma",
                    collectiveCode = "ABC123",
                    text = "broken",
                    timestamp = LocalDateTime.now(),
                    reactions = "not-json",
                    poll = "not-json",
                ),
            ),
        )

        val result = operations.getMessages("Kasper").single()

        assertTrue(result.reactions.isEmpty())
        assertNull(result.poll)
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
