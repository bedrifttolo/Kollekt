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
) {
    @Transactional
    fun deleteUser(memberName: String) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")

        val collectiveCode = member.collectiveCode
        memberRepository.delete(member)

        if (collectiveCode != null) {
            redistributeOpenTasks(memberName, collectiveCode)
            taskOperations.regenerateRecurringTasksForCollective(collectiveCode)
        }
    }

    @Transactional
    fun leaveCollective(memberName: String) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")
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
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")
        val normalized = color.trim()
        require(normalized.matches(Regex("^#[0-9a-fA-F]{6}$"))) { "Color must be a hex value like #1f563f" }
        memberRepository.save(member.copy(color = normalized))
    }

    fun getPaymentHandles(memberName: String): PaymentHandlesDto {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")
        return PaymentHandlesDto(
            vipps = member.vippsHandle,
            mobilepay = member.mobilepayHandle,
            paypal = member.paypalHandle,
            bankAccount = member.bankAccount,
        )
    }

    @Transactional
    fun updatePaymentHandles(request: UpdatePaymentHandlesRequest): PaymentHandlesDto {
        val member =
            memberRepository.findByName(request.memberName)
                ?: throw IllegalArgumentException("User '${request.memberName}' not found")

        val vipps = normalizePhoneHandle(request.vipps, "Vipps")
        val mobilepay = normalizePhoneHandle(request.mobilepay, "MobilePay")
        val paypal = normalizePaypalHandle(request.paypal)
        val bankAccount = normalizeBankAccount(request.bankAccount)

        memberRepository.save(
            member.copy(
                vippsHandle = vipps,
                mobilepayHandle = mobilepay,
                paypalHandle = paypal,
                bankAccount = bankAccount,
            ),
        )

        return PaymentHandlesDto(vipps = vipps, mobilepay = mobilepay, paypal = paypal, bankAccount = bankAccount)
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

    @Transactional
    fun updateMemberStatus(
        memberName: String,
        newStatus: MemberStatus,
        awayUntil: java.time.LocalDate? = null,
    ) {
        val member =
            memberRepository.findByName(memberName)
                ?: throw IllegalArgumentException("User '$memberName' not found")

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
        memberRepository
            .findAllByCollectiveCode(collectiveAccessService.requireCollectiveCodeByMemberName(memberName))
            .sortedBy { it.name }
            .map(userProfileService::toUserDto)

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
