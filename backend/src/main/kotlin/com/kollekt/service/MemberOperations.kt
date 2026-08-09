package com.kollekt.service

import com.kollekt.api.dto.PaymentHandlesDto
import com.kollekt.api.dto.UpdatePaymentHandlesRequest
import com.kollekt.domain.MemberStatus
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class MemberOperations(
    private val memberRepository: MemberRepository,
    private val taskRepository: TaskRepository,
    private val taskOperations: TaskOperations,
    private val userProfileService: UserProfileService,
    private val collectiveAccessService: CollectiveAccessService,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val currentMemberContext: CurrentMemberContext,
) {
    private fun requireSelf(memberName: String) = currentMemberContext.current(memberName)

    @Transactional
    fun deleteUser(memberName: String) {
        val member = requireSelf(memberName)

        val collectiveCode = member.collectiveCode
        memberRepository.delete(member)

        if (collectiveCode != null) {
            redistributeOpenTasks(memberName, collectiveCode)
            taskOperations.regenerateRecurringTasksForCollective(collectiveCode)
        }
    }

    @Transactional
    fun leaveCollective(memberName: String) {
        val member = requireSelf(memberName)
        val collectiveCode = member.collectiveCode ?: return

        memberRepository.save(member.copy(collectiveCode = null))
        redistributeOpenTasks(memberName, collectiveCode)
        taskOperations.regenerateRecurringTasksForCollective(collectiveCode)
    }

    @Transactional
    fun updateMemberColor(
        memberName: String,
        color: String,
    ) {
        val member = requireSelf(memberName)
        val normalized = color.trim()
        require(normalized.matches(Regex("^#[0-9a-fA-F]{6}$"))) { "Color must be a hex value like #1f563f" }

        val collectiveCode = member.collectiveCode
        if (collectiveCode != null) {
            val taken =
                memberRepository
                    .findAllByCollectiveCode(collectiveCode)
                    .any { it.name != memberName && it.color.equals(normalized, ignoreCase = true) }
            require(!taken) { "That color is already taken by someone else in your household" }
        }

        memberRepository.save(member.copy(color = normalized))

        if (collectiveCode != null) {
            realtimeUpdateService.publish(
                collectiveCode,
                "MEMBER_UPDATED",
                mapOf("memberName" to memberName, "color" to normalized),
            )
        }
    }

    @Transactional
    fun updateMemberLanguage(
        memberName: String,
        language: String,
    ) {
        val member = requireSelf(memberName)
        require(language in setOf("en", "no", "sv", "da")) { "Language must be one of en, no, sv, da" }
        memberRepository.save(member.copy(language = language))
    }

    fun getPaymentHandles(memberName: String): PaymentHandlesDto {
        val member = requireSelf(memberName)
        return PaymentHandlesDto(
            vipps = member.vippsHandle,
            mobilepay = member.mobilepayHandle,
            paypal = member.paypalHandle,
            bankAccount = member.bankAccount,
            cardInfo = member.cardInfo,
        )
    }

    @Transactional
    fun updatePaymentHandles(request: UpdatePaymentHandlesRequest): PaymentHandlesDto {
        val member = requireSelf(request.memberName)

        val vipps = normalizePhoneHandle(request.vipps, "Vipps")
        val mobilepay = normalizePhoneHandle(request.mobilepay, "MobilePay")
        val paypal = normalizePaypalHandle(request.paypal)
        val bankAccount = normalizeBankAccount(request.bankAccount)
        val cardInfo = normalizeCardInfo(request.cardInfo)

        memberRepository.save(
            member.copy(
                vippsHandle = vipps,
                mobilepayHandle = mobilepay,
                paypalHandle = paypal,
                bankAccount = bankAccount,
                cardInfo = cardInfo,
            ),
        )

        return PaymentHandlesDto(
            vipps = vipps,
            mobilepay = mobilepay,
            paypal = paypal,
            bankAccount = bankAccount,
            cardInfo = cardInfo,
        )
    }

    private fun normalizePhoneHandle(
        raw: String?,
        label: String,
    ): String? {
        val trimmed = raw?.replace(Regex("[\\s-]"), "")?.trim().orEmpty()
        if (trimmed.isBlank()) return null
        require(trimmed.matches(Regex("^\\+?[0-9]{8,15}$"))) { "$label number must be 8–15 digits" }
        return trimmed
    }

    private fun normalizePaypalHandle(raw: String?): String? {
        val trimmed = raw?.trim()?.removePrefix("https://paypal.me/")?.removePrefix("paypal.me/")?.trim('@')?.trim().orEmpty()
        if (trimmed.isBlank()) return null
        require(trimmed.matches(Regex("^[A-Za-z0-9]{1,20}$"))) { "PayPal.Me handle must be 1–20 letters or digits" }
        return trimmed
    }

    private fun normalizeBankAccount(raw: String?): String? {
        val trimmed = raw?.replace(Regex("\\s"), "")?.trim().orEmpty()
        if (trimmed.isBlank()) return null
        require(trimmed.matches(Regex("^[A-Za-z0-9]{6,34}$"))) { "Bank account / IBAN must be 6–34 letters or digits" }
        return trimmed.uppercase()
    }

    // Freeform note, not a structured handle — no format to validate. Still guarded against
    // holding an actual card number: this field is shown as-is to any housemate who owes money,
    // so storing a real PAN here would be a plaintext-card-data exposure, not just bad advice.
    private fun normalizeCardInfo(raw: String?): String? {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isBlank()) return null
        require(trimmed.length <= 256) { "Card payment note must be 256 characters or fewer" }
        val digitsOnly = trimmed.replace(Regex("[^0-9]"), "")
        require(digitsOnly.length < 12) { "Don't enter a full card number here — leave a note instead, like \"ask me in person\"" }
        return trimmed
    }

    @Transactional
    fun updateMemberStatus(
        memberName: String,
        newStatus: MemberStatus,
        awayUntil: java.time.LocalDate? = null,
    ) {
        val member = requireSelf(memberName)

        val resolvedAwayUntil = if (newStatus == MemberStatus.AWAY) awayUntil else null
        require(resolvedAwayUntil == null || !resolvedAwayUntil.isBefore(java.time.LocalDate.now())) {
            "Away date must be today or later"
        }
        memberRepository.save(member.copy(status = newStatus, awayUntil = resolvedAwayUntil))

        if (member.collectiveCode != null && member.status != newStatus) {
            taskOperations.regenerateRecurringTasksForCollective(member.collectiveCode)
        }
    }

    // #8 Away mode: members whose away period has elapsed are returned to ACTIVE so they
    // re-enter chore rotation automatically. Runs from the daily maintenance schedule.
    @Transactional
    fun resumeExpiredAwayMembers() {
        val today = java.time.LocalDate.now()
        val resumed =
            memberRepository
                .findAll()
                .filter { it.status == MemberStatus.AWAY && it.awayUntil != null && it.awayUntil.isBefore(today) }
                .map { memberRepository.save(it.copy(status = MemberStatus.ACTIVE, awayUntil = null)) }
        resumed.mapNotNull { it.collectiveCode }.distinct().forEach {
            taskOperations.regenerateRecurringTasksForCollective(it)
        }
    }

    fun addFriend(
        memberName: String,
        friendName: String,
    ) = userProfileService.addFriend(memberName, friendName)

    fun removeFriend(
        memberName: String,
        friendName: String,
    ) = userProfileService.removeFriend(memberName, friendName)

    fun getCollectiveMembers(memberName: String) =
        userProfileService.toUserDtos(
            memberRepository
                .findAllByCollectiveCode(collectiveAccessService.requireCollectiveCodeByMemberName(memberName))
                .sortedBy { it.name },
        )

    private fun redistributeOpenTasks(
        departingMemberName: String,
        collectiveCode: String,
    ) {
        val remainingMembers =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.name != departingMemberName && it.status == MemberStatus.ACTIVE }

        val memberNames = remainingMembers.map { it.name }.sorted()
        if (memberNames.isEmpty()) {
            return
        }

        val tasksInCollective = taskRepository.findAllByCollectiveCode(collectiveCode)
        val tasksToReassign =
            tasksInCollective
                .filter { it.assignee == departingMemberName && !it.completed }

        data class MemberLoad(
            val count: Int,
            val xp: Int,
        )

        val uncompletedTasks =
            tasksInCollective
                .filter { !it.completed && it.assignee in memberNames }

        val memberLoad =
            memberNames
                .associateWith { memberName ->
                    MemberLoad(
                        count = uncompletedTasks.count { it.assignee == memberName },
                        xp = uncompletedTasks.filter { it.assignee == memberName }.sumOf { it.xp },
                    )
                }.toMutableMap()

        for (task in tasksToReassign) {
            val newAssignee =
                memberLoad.entries
                    .minWithOrNull(
                        compareBy<Map.Entry<String, MemberLoad>> { it.value.count }.thenBy { it.value.xp },
                    )?.key ?: memberNames.first()

            taskRepository.save(task.copy(assignee = newAssignee))

            val previous = memberLoad[newAssignee] ?: MemberLoad(count = 0, xp = 0)
            memberLoad[newAssignee] = previous.copy(count = previous.count + 1, xp = previous.xp + task.xp)
        }
    }
}
