package com.kollekt.api

import com.kollekt.service.CollectiveOperations
import com.kollekt.service.CurrentMemberContext
import com.kollekt.service.MemberOperations
import com.kollekt.service.TokenStoreService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(
    properties = ["app.security.jwt-secret=test-jwt-secret-that-is-long-enough"],
    controllers = [MemberController::class],
)
class MemberControllerContractTest {
    @Autowired lateinit var mockMvc: MockMvc

    @MockitoBean lateinit var memberOperations: MemberOperations

    @MockitoBean lateinit var collectiveOperations: CollectiveOperations

    @MockitoBean lateinit var tokenStoreService: TokenStoreService

    @MockitoBean lateinit var currentMemberContext: CurrentMemberContext

    @Test
    fun `member invite delegates to the service with token subject`() {
        mockMvc
            .perform(
                post("/api/members/invite")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"email":"emma@example.com","collectiveCode":"ABC123"}"""),
            ).andExpect(status().isOk)

        verify(collectiveOperations).inviteUserToCollective("emma@example.com", "ABC123", "Kasper")
    }

    @Test
    fun `member status update accepts valid enum values`() {
        mockMvc
            .perform(
                patch("/api/members/status")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"memberName":"Kasper","status":"away"}"""),
            ).andExpect(status().isOk)

        verify(memberOperations).updateMemberStatus("Kasper", com.kollekt.domain.MemberStatus.AWAY)
    }

    @Test
    fun `member leave collective delegates when token subject matches`() {
        mockMvc
            .perform(
                patch("/api/members/leave-collective")
                    .param("memberName", "Kasper")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)

        verify(memberOperations).leaveCollective("Kasper")
    }

    @Test
    fun `member color update forwards member and color`() {
        mockMvc
            .perform(
                patch("/api/members/color")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"memberName":"Kasper","color":"#1f563f"}"""),
            ).andExpect(status().isOk)

        verify(memberOperations).updateMemberColor("Kasper", "#1f563f")
    }

    @Test
    fun `member delete delegates when token subject matches member`() {
        mockMvc
            .perform(
                delete("/api/members/delete")
                    .param("memberName", "Kasper")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)

        verify(memberOperations).deleteUser("Kasper")
    }

    @Test
    fun `member add and remove friend endpoints delegate expected names`() {
        mockMvc
            .perform(
                post("/api/members/friends/add")
                    .param("memberName", "Kasper")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{"friendName":"Emma"}"""),
            ).andExpect(status().isOk)

        mockMvc
            .perform(
                delete("/api/members/friends/remove")
                    .param("memberName", "Kasper")
                    .param("friendName", "Emma")
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") }),
            ).andExpect(status().isOk)

        verify(memberOperations).addFriend("Kasper", "Emma")
        verify(memberOperations).removeFriend("Kasper", "Emma")
    }

    @Test
    fun `member add friend rejects missing friend name`() {
        mockMvc
            .perform(
                post("/api/members/friends/add")
                    .param("memberName", "Kasper")
                    .contentType(MediaType.APPLICATION_JSON)
                    .with(csrf())
                    .with(jwt().jwt { it.subject("Kasper") })
                    .content("""{}"""),
            ).andExpect(status().isBadRequest)

        verify(memberOperations, never()).addFriend(any(), any())
    }
}
