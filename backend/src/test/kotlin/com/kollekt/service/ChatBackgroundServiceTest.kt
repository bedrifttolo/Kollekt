package com.kollekt.service

import com.kollekt.domain.ChatBackground
import com.kollekt.domain.Member
import com.kollekt.repository.ChatBackgroundRepository
import com.kollekt.repository.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.mock.web.MockMultipartFile

class ChatBackgroundServiceTest {
    private lateinit var chatBackgroundRepository: ChatBackgroundRepository
    private lateinit var memberRepository: MemberRepository
    private lateinit var collectiveAccessService: CollectiveAccessService
    private lateinit var imageSafetyService: ImageSafetyService
    private lateinit var realtimeUpdateService: RealtimeUpdateService
    private lateinit var service: ChatBackgroundService

    private val jpegBytes = byteArrayOf(1, 2, 3, 4)

    @BeforeEach
    fun setUp() {
        chatBackgroundRepository = mock()
        memberRepository = mock()
        collectiveAccessService = mock()
        imageSafetyService = mock()
        realtimeUpdateService = mock()
        service =
            ChatBackgroundService(
                chatBackgroundRepository,
                memberRepository,
                collectiveAccessService,
                imageSafetyService,
                realtimeUpdateService,
            )
        whenever(collectiveAccessService.requireCollectiveCodeByMemberName(any())).thenReturn("ABC123")
        whenever(imageSafetyService.validateAndModerate(any(), any())).thenReturn(SafeImage(jpegBytes, "image/jpeg"))
        // doAnswer-first form: stubbing `save` the whenever(...) way calls the mock with a null
        // argument, and its non-null Kotlin return type turns that into an NPE during setup.
        doAnswer { it.arguments[0] }.whenever(chatBackgroundRepository).save(any())
    }

    @Test
    fun `both sides of a direct thread resolve to the same key whoever sets it`() {
        assertEquals(
            ChatBackgroundService.threadKey("Alice", "Bob"),
            ChatBackgroundService.threadKey("Bob", "Alice"),
        )
        // ...and it is distinct from the household thread's key.
        assertEquals("household", ChatBackgroundService.threadKey("Alice", null))
    }

    @Test
    fun `setting the household wallpaper stores it under the shared key and tells the household`() {
        service.set("Alice", null, multipart())

        val saved = argumentCaptor<ChatBackground>()
        verify(chatBackgroundRepository).save(saved.capture())
        assertEquals("household", saved.firstValue.threadKey)
        assertEquals("ABC123", saved.firstValue.collectiveCode)
        assertEquals("Alice", saved.firstValue.setBy)

        // Household-wide, so everyone's open thread refetches — not just the setter's.
        verify(realtimeUpdateService).publish(eq("ABC123"), eq(ChatBackgroundService.CHANGED_EVENT), any())
    }

    @Test
    fun `setting a direct wallpaper notifies only the two participants`() {
        whenever(memberRepository.findByNameAndCollectiveCode("Bob", "ABC123")).thenReturn(member("Bob"))

        service.set("Alice", "Bob", multipart())

        val saved = argumentCaptor<ChatBackground>()
        verify(chatBackgroundRepository).save(saved.capture())
        assertEquals(ChatBackgroundService.threadKey("Alice", "Bob"), saved.firstValue.threadKey)

        verify(realtimeUpdateService).publishToMembers(
            eq("ABC123"),
            eq(setOf("Alice", "Bob")),
            eq(ChatBackgroundService.CHANGED_EVENT),
            any(),
        )
    }

    @Test
    fun `a second set overwrites the thread's existing row rather than adding another`() {
        val existing =
            ChatBackground(
                id = 7,
                collectiveCode = "ABC123",
                threadKey = "household",
                imageData = "old",
                imageMimeType = "image/png",
                setBy = "Bob",
            )
        whenever(chatBackgroundRepository.findByCollectiveCodeAndThreadKey("ABC123", "household")).thenReturn(existing)

        service.set("Alice", null, multipart())

        val saved = argumentCaptor<ChatBackground>()
        verify(chatBackgroundRepository).save(saved.capture())
        assertEquals(7, saved.firstValue.id)
        assertEquals("Alice", saved.firstValue.setBy)
        assertEquals("image/jpeg", saved.firstValue.imageMimeType)
    }

    @Test
    fun `reading a thread with no wallpaper is an empty result, not an error`() {
        whenever(chatBackgroundRepository.findByCollectiveCodeAndThreadKey("ABC123", "household")).thenReturn(null)

        val dto = service.get("Alice", null)

        assertNull(dto.imageUrl)
        assertNull(dto.setBy)
    }

    @Test
    fun `a stored wallpaper is returned as a ready-to-render data URL`() {
        whenever(chatBackgroundRepository.findByCollectiveCodeAndThreadKey("ABC123", "household"))
            .thenReturn(
                ChatBackground(
                    collectiveCode = "ABC123",
                    threadKey = "household",
                    imageData = "AQIDBA==",
                    imageMimeType = "image/jpeg",
                    setBy = "Bob",
                ),
            )

        val dto = service.get("Alice", null)

        assertEquals("data:image/jpeg;base64,AQIDBA==", dto.imageUrl)
        assertEquals("Bob", dto.setBy)
    }

    @Test
    fun `a direct thread with someone outside the collective is rejected`() {
        whenever(memberRepository.findByNameAndCollectiveCode("Stranger", "ABC123")).thenReturn(null)

        assertThrows(IllegalArgumentException::class.java) {
            service.set("Alice", "Stranger", multipart())
        }
        verify(chatBackgroundRepository, org.mockito.kotlin.never()).save(any())
    }

    @Test
    fun `clearing removes the thread's row and tells the thread`() {
        service.clear("Alice", null)

        verify(chatBackgroundRepository).deleteByCollectiveCodeAndThreadKey("ABC123", "household")
        verify(realtimeUpdateService).publish(eq("ABC123"), eq(ChatBackgroundService.CHANGED_EVENT), any())
    }

    private fun multipart() = MockMultipartFile("image", "wallpaper.jpg", "image/jpeg", jpegBytes)

    private fun member(name: String) =
        Member(
            name = name,
            email = "${name.lowercase()}@example.com",
            passwordHash = "x",
            collectiveCode = "ABC123",
        )
}
