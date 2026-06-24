package com.kollekt.service

import com.kollekt.domain.MemberStatus
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.MemberRepository
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service

/**
 * Scheduled jobs for the student-living improvement features:
 *  - #4 recurring shared bills regenerate monthly,
 *  - #8 away members auto-resume to ACTIVE once their away date passes,
 *  - #10 a weekly recap notification is sent to each household.
 *
 * Kept separate from [TaskMaintenanceService] so its existing constructor/tests are untouched.
 */
@Service
class StudentLivingMaintenanceService(
    private val economyOperations: EconomyOperations,
    private val memberOperations: MemberOperations,
    private val statsService: StatsService,
    private val notificationService: NotificationService,
    private val collectiveRepository: CollectiveRepository,
    private val memberRepository: MemberRepository,
) {
    @Scheduled(cron = "0 0 6 * * *")
    fun generateRecurringExpenses() = economyOperations.generateRecurringExpenseInstances()

    @Scheduled(cron = "0 30 3 * * *")
    fun resumeAwayMembers() = memberOperations.resumeExpiredAwayMembers()

    // Monday mornings: one upbeat household summary per collective.
    @Scheduled(cron = "0 0 9 * * MON")
    fun sendWeeklyRecaps() {
        collectiveRepository.findAll().forEach { collective ->
            val recap = statsService.buildWeeklyRecap(collective.joinCode)
            if (recap.tasksCompleted == 0 && recap.expensesLogged == 0) return@forEach
            val recipients =
                memberRepository
                    .findAllByCollectiveCode(collective.joinCode)
                    .filter { it.status == MemberStatus.ACTIVE }
                    .map { it.name }
            if (recipients.isEmpty()) return@forEach
            notificationService.createParameterizedGroupNotification(
                userNames = recipients,
                type = "WEEKLY_RECAP",
                params =
                    mapOf(
                        "tasksCompleted" to recap.tasksCompleted.toString(),
                        "topContributor" to (recap.topContributor ?: ""),
                        "topContributorTasks" to recap.topContributorTasks.toString(),
                        "expensesLogged" to recap.expensesLogged.toString(),
                        "bestStreak" to recap.bestStreak.toString(),
                        "bestStreakHolder" to (recap.bestStreakHolder ?: ""),
                    ),
            )
        }
    }
}
