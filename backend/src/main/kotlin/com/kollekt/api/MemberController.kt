
package com.kollekt.api

import com.kollekt.api.dto.UserDto
import com.kollekt.service.AccountOperations
import com.kollekt.service.CollectiveOperations
import com.kollekt.service.MemberOperations
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/members")
class MemberController(
    private val memberOperations: MemberOperations,
    private val collectiveOperations: CollectiveOperations,
    private val accountOperations: AccountOperations,
) {
    data class InviteRequest(
        val email: String,
        val collectiveCode: String,
    )

    data class StatusUpdateRequest(
        val memberName: String,
        val status: String,
    )

    data class ColorUpdateRequest(
        val memberName: String,
        val color: String,
    )

    @PatchMapping("/leave-collective")
    fun leaveCollective(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        memberOperations.leaveCollective(memberName)
    }

    @PostMapping("/invite")
    fun inviteUser(
        @RequestBody req: InviteRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        // Only allow inviting if the user is in the collective
        collectiveOperations.inviteUserToCollective(req.email, req.collectiveCode, jwt.subject)
    }

    @PatchMapping("/status")
    fun updateStatus(
        @RequestBody req: StatusUpdateRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, req.memberName)
        val newStatus =
            try {
                com.kollekt.domain.MemberStatus
                    .valueOf(req.status.uppercase())
            } catch (e: Exception) {
                throw IllegalArgumentException("Invalid status")
            }
        memberOperations.updateMemberStatus(req.memberName, newStatus)
    }

    @PatchMapping("/color")
    fun updateColor(
        @RequestBody req: ColorUpdateRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, req.memberName)
        memberOperations.updateMemberColor(req.memberName, req.color)
    }

    @GetMapping("/payment-handles")
    fun getPaymentHandles(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): com.kollekt.api.dto.PaymentHandlesDto {
        requireTokenSubject(jwt, memberName)
        return memberOperations.getPaymentHandles(memberName)
    }

    @PatchMapping("/payment-handles")
    fun updatePaymentHandles(
        @RequestBody req: com.kollekt.api.dto.UpdatePaymentHandlesRequest,
        @AuthenticationPrincipal jwt: Jwt,
    ): com.kollekt.api.dto.PaymentHandlesDto {
        requireTokenSubject(jwt, req.memberName)
        return memberOperations.updatePaymentHandles(req)
    }

    @GetMapping("/collective")
    fun getCollectiveMembers(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ): List<UserDto> {
        requireTokenSubject(jwt, memberName)
        return memberOperations.getCollectiveMembers(memberName)
    }

    @PatchMapping("/reset-password")
    fun resetPassword(
        @RequestParam memberName: String,
        @RequestBody body: Map<String, String>,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        val newPassword = body["newPassword"] ?: throw IllegalArgumentException("Missing newPassword")
        if (newPassword.length < 8) throw IllegalArgumentException("Password must be at least 8 characters")
        accountOperations.resetPassword(memberName, newPassword)
    }

    @DeleteMapping("/delete")
    fun deleteUser(
        @RequestParam memberName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        memberOperations.deleteUser(memberName)
    }

    @PostMapping("/friends/add")
    fun addFriend(
        @RequestParam memberName: String,
        @RequestBody body: Map<String, String>,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        val friendName = body["friendName"] ?: throw IllegalArgumentException("Missing friendName")
        memberOperations.addFriend(memberName, friendName)
    }

    @DeleteMapping("/friends/remove")
    fun removeFriend(
        @RequestParam memberName: String,
        @RequestParam friendName: String,
        @AuthenticationPrincipal jwt: Jwt,
    ) {
        requireTokenSubject(jwt, memberName)
        memberOperations.removeFriend(memberName, friendName)
    }
}
