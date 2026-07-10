package com.kollekt.service

import com.kollekt.api.dto.AchievementCatalogItemDto
import com.kollekt.api.dto.AchievementDto
import com.kollekt.api.dto.CreateCustomAchievementRequest
import com.kollekt.api.dto.DashboardResponse
import com.kollekt.api.dto.EventDto
import com.kollekt.api.dto.ExpenseDto
import com.kollekt.api.dto.LeaderboardPeriod
import com.kollekt.api.dto.LeaderboardPlayerDto
import com.kollekt.api.dto.LeaderboardResponse
import com.kollekt.api.dto.MemberStatsDto
import com.kollekt.api.dto.PeriodStatsDto
import com.kollekt.api.dto.ShoppingItemDto
import com.kollekt.api.dto.TaskDto
import com.kollekt.domain.CalendarEvent
import com.kollekt.domain.CustomAchievement
import com.kollekt.domain.CustomAchievementMetric
import com.kollekt.domain.Expense
import com.kollekt.domain.Member
import com.kollekt.domain.TaskHistoryEntry
import com.kollekt.domain.TaskItem
import com.kollekt.repository.CheckinResponseRepository
import com.kollekt.repository.CollectiveRepository
import com.kollekt.repository.CustomAchievementRepository
import com.kollekt.repository.EventRepository
import com.kollekt.repository.ExpenseRepository
import com.kollekt.repository.HouseCheckinRepository
import com.kollekt.repository.MemberRepository
import com.kollekt.repository.TaskHistoryRepository
import com.kollekt.repository.TaskRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.TemporalAdjusters
import kotlin.math.roundToInt

private data class AchievementDefinition(
    val key: String,
    val title: String,
    val description: String,
    val icon: String,
    val total: Int,
    val compute: (tasks: List<TaskItem>, member: Member, streak: Int) -> Int,
)

// Icons a member may pick for a custom house goal. Kept in sync with the picker in RanksPanel.tsx;
// anything else falls back to the default so the stored value always maps to a known frontend icon.
private val CUSTOM_ACHIEVEMENT_ICONS: Set<String> =
    setOf("sparkles", "trophy", "star", "flame", "zap", "heart", "crown", "medal", "target", "rocket", "leaf", "sun")

private val ACHIEVEMENT_DEFINITIONS: List<AchievementDefinition> =
    listOf(
        AchievementDefinition("TASK_1", "First Step", "Complete your first task", "check", 1) { t, _, _ ->
            t.count { it.completed }.coerceAtMost(1)
        },
        AchievementDefinition("TASK_5", "Getting Going", "Complete 5 tasks", "star", 5) { t, _, _ ->
            t.count { it.completed }.coerceAtMost(5)
        },
        AchievementDefinition("TASK_10", "Ten Done", "Complete 10 tasks", "star-half", 10) { t, _, _ ->
            t.count { it.completed }.coerceAtMost(10)
        },
        AchievementDefinition("TASK_25", "Household Hero", "Complete 25 tasks", "home", 25) { t, _, _ ->
            t.count { it.completed }.coerceAtMost(25)
        },
        AchievementDefinition("TASK_50", "Task Titan", "Complete 50 tasks", "trophy", 50) { t, _, _ ->
            t.count { it.completed }.coerceAtMost(50)
        },
        AchievementDefinition("STREAK_3", "On a Roll", "Complete tasks 3 days in a row", "flame", 3) { _, _, streak ->
            streak.coerceAtMost(3)
        },
        AchievementDefinition("STREAK_7", "Week Warrior", "Complete tasks 7 days in a row", "zap", 7) { _, _, streak ->
            streak.coerceAtMost(7)
        },
        AchievementDefinition("STREAK_14", "Fortnight Force", "Complete tasks 14 days in a row", "flame", 14) { _, _, streak ->
            streak.coerceAtMost(14)
        },
        AchievementDefinition("EARLY_BIRD", "Early Bird", "Complete 3 tasks before the due date", "sunrise", 3) { t, _, _ ->
            t.count { it.completed && it.completedAt != null && it.completedAt.toLocalDate() < it.dueDate }.coerceAtMost(3)
        },
        AchievementDefinition("EARLY_10", "Ahead of the Game", "Complete 10 tasks before the due date", "sunrise", 10) { t, _, _ ->
            t.count { it.completed && it.completedAt != null && it.completedAt.toLocalDate() < it.dueDate }.coerceAtMost(10)
        },
        AchievementDefinition("ON_TIME_10", "Right on Time", "Complete 10 tasks by their due date", "clock", 10) { t, _, _ ->
            t.count { it.completed && it.completedAt != null && !it.completedAt.toLocalDate().isAfter(it.dueDate) }.coerceAtMost(10)
        },
        AchievementDefinition("NO_PENALTY", "Clean Record", "Complete 5 tasks without any penalty", "shield", 5) { t, _, _ ->
            t.count { it.completed && it.penaltyXp == 0 }.coerceAtMost(5)
        },
        AchievementDefinition("CLEANING_5", "Clean House", "Complete 5 cleaning tasks", "sparkles", 5) { t, _, _ ->
            t.count { it.completed && it.category == com.kollekt.domain.TaskCategory.CLEANING }.coerceAtMost(5)
        },
        AchievementDefinition("DISHES_5", "Dish Destroyer", "Complete 5 dishwashing tasks", "sparkles", 5) { t, _, _ ->
            t.count { it.completed && it.category == com.kollekt.domain.TaskCategory.DISHES }.coerceAtMost(5)
        },
        AchievementDefinition("TRASH_5", "Trash Champion", "Complete 5 trash tasks", "trash", 5) { t, _, _ ->
            t.count { it.completed && it.category == com.kollekt.domain.TaskCategory.TRASH }.coerceAtMost(5)
        },
        AchievementDefinition("RECURRING_10", "Reliable Roommate", "Complete 10 recurring tasks", "repeat", 10) { t, _, _ ->
            t.count { it.completed && !it.recurrenceRule.isNullOrBlank() && it.recurrenceRule.uppercase() != "NONE" }.coerceAtMost(10)
        },
        AchievementDefinition("LEVEL_2", "Level Up", "Reach level 2", "trending-up", 2) { _, m, _ ->
            m.level.coerceAtMost(2)
        },
        AchievementDefinition("LEVEL_5", "Household Pro", "Reach level 5", "trending-up", 5) { _, m, _ ->
            m.level.coerceAtMost(5)
        },
        AchievementDefinition("XP_100", "Century", "Earn 100 XP", "award", 100) { _, m, _ ->
            m.xp.coerceAtMost(100)
        },
        AchievementDefinition("XP_500", "XP Grinder", "Earn 500 XP", "trophy", 500) { _, m, _ ->
            m.xp.coerceAtMost(500)
        },
        AchievementDefinition("XP_1000", "Four Digits", "Earn 1,000 XP", "award", 1000) { _, m, _ ->
            m.xp.coerceAtMost(1000)
        },
    )

private val DEFAULT_ENABLED_KEYS: Set<String> =
    setOf(
        "TASK_1",
        "TASK_10",
        "STREAK_3",
        "EARLY_BIRD",
        "ON_TIME_10",
        "CLEANING_5",
        "RECURRING_10",
        "LEVEL_2",
        "XP_100",
    )

@Service
class StatsService(
    private val collectiveAccessService: CollectiveAccessService,
    private val memberRepository: MemberRepository,
    private val collectiveRepository: CollectiveRepository,
    private val customAchievementRepository: CustomAchievementRepository,
    private val taskRepository: TaskRepository,
    private val taskHistoryRepository: TaskHistoryRepository,
    private val eventRepository: EventRepository,
    private val expenseRepository: ExpenseRepository,
    private val realtimeUpdateService: RealtimeUpdateService,
    private val economyOperations: EconomyOperations,
    private val shoppingItemRepository: com.kollekt.repository.ShoppingItemRepository,
    private val checkinRepository: HouseCheckinRepository,
    private val checkinResponseRepository: CheckinResponseRepository,
) {
    fun getLeaderboard(
        memberName: String,
        period: LeaderboardPeriod = LeaderboardPeriod.OVERALL,
    ): LeaderboardResponse {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")

        return buildLeaderboard(
            collective = collective,
            allTasks = tasksWithHistory(collectiveCode),
            members = memberRepository.findAllByCollectiveCode(collectiveCode),
            period = period,
        )
    }

    private fun buildLeaderboard(
        collective: com.kollekt.domain.Collective,
        allTasks: List<TaskItem>,
        members: List<Member>,
        period: LeaderboardPeriod,
    ): LeaderboardResponse {
        val now = LocalDateTime.now()
        val completedTasks =
            when (period) {
                LeaderboardPeriod.OVERALL -> {
                    allTasks.filter { it.completed }
                }

                LeaderboardPeriod.YEAR -> {
                    allTasks.filter { it.completed && it.completedAt?.year == now.year }
                }

                LeaderboardPeriod.MONTH -> {
                    allTasks.filter {
                        it.completed && it.completedAt?.year == now.year && it.completedAt?.month == now.month
                    }
                }
            }

        // Period XP is the base XP of the member's tasks completed within the selected period,
        // so Total/Year/Month rankings reflect their period. Lifetime XP stays in member.xp.
        val periodXpByMember =
            members.associateWith { member -> completedTasks.filter { it.assignee == member.name }.sumOf { it.xp } }
        val rankedMembers =
            periodXpByMember.keys.sortedWith(
                compareByDescending<Member> { periodXpByMember.getValue(it) }.thenBy { it.name },
            )

        val players =
            rankedMembers.mapIndexed { index, member ->
                val memberTasks = completedTasks.filter { it.assignee == member.name }
                val streak = computeStreak(allTasks.filter { it.assignee == member.name })
                LeaderboardPlayerDto(
                    rank = index + 1,
                    name = member.name,
                    level = member.level,
                    xp = periodXpByMember.getValue(member),
                    tasksCompleted = memberTasks.size,
                    streak = streak,
                    badges = buildBadges(index + 1, streak, member.level, memberTasks.size),
                )
            }

        val periodStats = buildPeriodStats(players, completedTasks, allTasks, rankedMembers)

        val response =
            LeaderboardResponse(
                players = players,
                periodStats = periodStats,
                monthlyPrize = collective.monthlyPrize,
            )

        return response
    }

    fun getMonthlyPrize(memberName: String): String? {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        return collective.monthlyPrize
    }

    @Transactional
    fun setMonthlyPrize(
        memberName: String,
        prize: String?,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        collectiveRepository.save(collective.copy(monthlyPrize = prize))
    }

    fun getAchievements(memberName: String): List<AchievementDto> {
        val member = collectiveAccessService.requireMember(memberName)
        val collectiveCode = collectiveAccessService.requireCollectiveCode(member)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        val enabledKeys = collective.enabledAchievementKeys.ifEmpty { DEFAULT_ENABLED_KEYS }

        val memberTasks = tasksWithHistory(collectiveCode).filter { it.assignee == memberName }
        val streak = computeStreak(memberTasks)

        val builtInAchievements =
            ACHIEVEMENT_DEFINITIONS
                .filter { it.key in enabledKeys }
                .mapIndexed { index, def ->
                    val progress = def.compute(memberTasks, member, streak)
                    AchievementDto(
                        id = index.toLong() + 1,
                        key = def.key,
                        title = def.title,
                        description = def.description,
                        icon = def.icon,
                        unlocked = progress >= def.total,
                        progress = progress,
                        total = def.total,
                    )
                }
        val customAchievements =
            customAchievementRepository
                .findAllByCollectiveCodeOrderByIdAsc(collectiveCode)
                .map { it.toDto(memberTasks, member, streak) }

        return builtInAchievements + customAchievements
    }

    fun getAchievementsCatalog(memberName: String): List<AchievementCatalogItemDto> {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        val enabledKeys = collective.enabledAchievementKeys.ifEmpty { DEFAULT_ENABLED_KEYS }

        return ACHIEVEMENT_DEFINITIONS.map { def ->
            AchievementCatalogItemDto(
                key = def.key,
                title = def.title,
                description = def.description,
                icon = def.icon,
                enabled = def.key in enabledKeys,
            )
        }
    }

    @Transactional
    fun updateAchievementConfig(
        memberName: String,
        enabledKeys: Set<String>,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val collective =
            collectiveRepository.findByJoinCode(collectiveCode)
                ?: throw IllegalArgumentException("Collective not found")
        collectiveRepository.save(collective.copy(enabledAchievementKeys = enabledKeys))
        realtimeUpdateService.publish(collectiveCode, "ACHIEVEMENT_CONFIG_UPDATED")
    }

    @Transactional
    fun createCustomAchievement(
        memberName: String,
        request: CreateCustomAchievementRequest,
    ): AchievementDto {
        val member = collectiveAccessService.requireMember(memberName)
        val collectiveCode = collectiveAccessService.requireCollectiveCode(member)
        val title = request.title.trim()
        val description = request.description.trim()
        require(title.isNotBlank() && title.length <= 80) { "Title must contain 1 to 80 characters" }
        require(description.isNotBlank() && description.length <= 240) { "Description must contain 1 to 240 characters" }
        require(request.target in 1..10_000) { "Target must be between 1 and 10000" }
        require(request.metric != CustomAchievementMetric.CATEGORY_COMPLETIONS || request.taskCategory != null) {
            "Task category is required for category achievements"
        }

        val icon = request.icon.takeIf { it in CUSTOM_ACHIEVEMENT_ICONS } ?: "sparkles"
        val saved =
            customAchievementRepository.save(
                CustomAchievement(
                    collectiveCode = collectiveCode,
                    createdBy = memberName,
                    title = title,
                    description = description,
                    metric = request.metric,
                    icon = icon,
                    target = request.target,
                    taskCategory = request.taskCategory,
                ),
            )
        realtimeUpdateService.publish(collectiveCode, "ACHIEVEMENT_CONFIG_UPDATED")
        val memberTasks = tasksWithHistory(collectiveCode).filter { it.assignee == memberName }
        return saved.toDto(memberTasks, member, computeStreak(memberTasks))
    }

    @Transactional
    fun deleteCustomAchievement(
        memberName: String,
        achievementId: Long,
    ) {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val achievement =
            customAchievementRepository.findByIdAndCollectiveCode(achievementId, collectiveCode)
                ?: throw IllegalArgumentException("Custom achievement not found")
        customAchievementRepository.delete(achievement)
        realtimeUpdateService.publish(collectiveCode, "ACHIEVEMENT_CONFIG_UPDATED")
    }

    fun getMemberStats(
        viewerName: String,
        targetName: String,
    ): MemberStatsDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(viewerName)
        val target =
            memberRepository.findByName(targetName)
                ?: throw IllegalArgumentException("Member not found")

        val allTasks = tasksWithHistory(collectiveCode)
        val memberTasks = allTasks.filter { it.assignee == targetName }
        val streak = computeStreak(memberTasks)
        val tasksCompleted = memberTasks.count { it.completed }
        val lateCompletions = memberTasks.count { it.completed && it.penaltyXp > 0 }
        val skippedTasks = memberTasks.count { !it.completed && it.dueDate < LocalDate.now() }

        val leaderboard = getLeaderboard(viewerName)
        val rank = leaderboard.players.firstOrNull { it.name == targetName }?.rank ?: leaderboard.players.size

        val achievements = getAchievements(targetName)

        return MemberStatsDto(
            name = target.name,
            level = target.level,
            xp = target.xp,
            rank = rank,
            streak = streak,
            tasksCompleted = tasksCompleted,
            lateCompletions = lateCompletions,
            skippedTasks = skippedTasks,
            achievementsUnlocked = achievements.count { it.unlocked },
            achievementsTotal = achievements.size,
        )
    }

    // #2 Fairness view: a non-punitive snapshot of how evenly recent chore load is shared
    // across active members, so resentment doesn't build silently.
    fun getFairness(
        memberName: String,
        windowDays: Long = 30,
    ): com.kollekt.api.dto.FairnessDto {
        val collectiveCode = collectiveAccessService.requireCollectiveCodeByMemberName(memberName)
        val since = LocalDate.now().minusDays(windowDays)
        val activeMembers =
            memberRepository
                .findAllByCollectiveCode(collectiveCode)
                .filter { it.status == com.kollekt.domain.MemberStatus.ACTIVE }
                .map { it.name }
                .sorted()
        val completedRecently =
            tasksWithHistory(collectiveCode)
                .filter { it.completed && it.completedAt != null && !it.completedAt.toLocalDate().isBefore(since) }
        val counts = activeMembers.associateWith { name -> completedRecently.count { it.completedBy == name } }
        val total = counts.values.sum()

        val shares =
            activeMembers.map { name ->
                val count = counts.getValue(name)
                com.kollekt.api.dto.MemberShareDto(
                    name = name,
                    completedTasks = count,
                    sharePercent = if (total == 0) 0 else (count * 100.0 / total).roundToInt(),
                )
            }
        val evenShare = if (activeMembers.isEmpty()) 0.0 else 100.0 / activeMembers.size
        val maxShare = shares.maxOfOrNull { it.sharePercent }?.toDouble() ?: evenShare
        val balancePercent = if (total == 0) 100 else (100 - (maxShare - evenShare)).roundToInt().coerceIn(0, 100)

        return com.kollekt.api.dto.FairnessDto(
            windowDays = windowDays.toInt(),
            totalTasks = total,
            balancePercent = balancePercent,
            shares = shares.sortedByDescending { it.completedTasks },
        )
    }

    // #10 Weekly recap: a short, upbeat summary of the household's week, used by the
    // scheduled recap notification to give members a reason to keep opening the app.
    fun buildWeeklyRecap(collectiveCode: String): com.kollekt.api.dto.WeeklyRecapDto {
        val today = LocalDate.now()
        val weekStart = today.minusDays(6)
        val allTasks = tasksWithHistory(collectiveCode)
        val completedThisWeek =
            allTasks.filter {
                it.completed && it.completedAt != null && it.completedAt.toLocalDate() in weekStart..today
            }
        val byContributor = completedThisWeek.groupingBy { it.completedBy ?: it.assignee }.eachCount()
        val top = byContributor.entries.maxByOrNull { it.value }

        val members = memberRepository.findAllByCollectiveCode(collectiveCode)
        val streaks = members.associate { it.name to computeStreak(allTasks.filter { t -> t.assignee == it.name }) }
        val bestStreak = streaks.entries.maxByOrNull { it.value }

        val expensesThisWeek =
            expenseRepository
                .findAllByCollectiveCode(collectiveCode)
                .count { it.date in weekStart..today }

        return com.kollekt.api.dto.WeeklyRecapDto(
            weekStart = weekStart,
            tasksCompleted = completedThisWeek.size,
            topContributor = top?.key,
            topContributorTasks = top?.value ?: 0,
            expensesLogged = expensesThisWeek,
            bestStreak = bestStreak?.value ?: 0,
            bestStreakHolder = bestStreak?.takeIf { it.value > 0 }?.key,
        )
    }

    fun getDashboard(memberName: String): DashboardResponse {
        val user = collectiveAccessService.requireMember(memberName)
        val collectiveCode = collectiveAccessService.requireCollectiveCode(user)
        val collective = collectiveAccessService.requireCollectiveByCode(collectiveCode)
        val members = memberRepository.findAllByCollectiveCode(collectiveCode)
        val liveTasks = taskRepository.findAllByCollectiveCode(collectiveCode)
        val allTasks = liveTasks + taskHistoryRepository.findAllByCollectiveCode(collectiveCode).map { it.toTaskItem() }
        val events = eventRepository.findAllByCollectiveCode(collectiveCode)
        val expenses = expenseRepository.findAllByCollectiveCode(collectiveCode)
        val leaderboard = buildLeaderboard(collective, allTasks, members, LeaderboardPeriod.OVERALL)
        val rank =
            leaderboard.players.firstOrNull { it.name == user.name }?.rank
                ?: leaderboard.players.size

        val balances = economyOperations.calculateBalancesForLoadedData(collectiveCode, expenses, members.map { it.name })
        val userBalance = balances.firstOrNull { it.name == user.name }?.amount ?: 0
        val today = LocalDate.now()
        val weekStart = today.minusDays(6)
        val weekTasks = allTasks.filter { it.dueDate in weekStart..today }
        // Only judge tasks that were actually due (today or earlier). Pending future tasks never
        // count against the household, and an overdue task lowers the score once — not twice.
        val dueTasks = weekTasks.filter { !it.dueDate.isAfter(today) }
        val onTrackRate =
            if (dueTasks.isEmpty()) 1.0 else dueTasks.count { it.completed }.toDouble() / dueTasks.size
        // The vibe is a positive, encouraging signal — most inputs add to it, and the only
        // negative (money imbalance) is small and capped so it can never dominate the score.
        // Positive reinforcement: completing chores this week lifts the vibe.
        val activityBonus =
            allTasks.count { it.completedAt?.toLocalDate()?.let { date -> date in weekStart..today } == true }
                .coerceAtMost(10)
        // Planning life together (shared events, guest nights) is a healthy-household signal.
        val planningBonus =
            events
                .count { it.date in weekStart..today.plusWeeks(1) }
                .coerceAtMost(6)
        // Sharing costs as a group shows the household is actively cooperating.
        val togethernessBonus =
            expenses
                .count { it.date in weekStart..today }
                .coerceAtMost(4)
        // A gentle nudge toward settling up — capped low so money imbalance never dominates.
        val balanceSpread =
            (balances.maxOfOrNull { it.amount } ?: 0) - (balances.minOfOrNull { it.amount } ?: 0)
        val balancePenalty = (balanceSpread / 300).coerceIn(0, 6)
        // A gentle lift or dip from how the house has felt in this week's check-in. Centered on a
        // neutral mood of 3/5 and capped at a few points, so it nudges the vibe without dominating
        // it — and the score floor below means a low mood can never make the household feel punished.
        val weekMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        val weeklyAverageMood =
            checkinRepository
                .findByCollectiveCodeAndWeekStart(collectiveCode, weekMonday)
                ?.let { checkinResponseRepository.findAllByCheckinIdOrderById(it.id) }
                ?.map { it.mood }
                ?.takeIf { it.isNotEmpty() }
                ?.average()
        val moodAdjustment =
            weeklyAverageMood?.let { (((it - 3.0) / 2.0) * 4.0).roundToInt().coerceIn(-4, 4) } ?: 0
        // Encouraging baseline with a generous floor, so the household never feels punished.
        val vibeScore =
            (58 + onTrackRate * 22 + activityBonus + planningBonus + togethernessBonus + moodAdjustment - balancePenalty)
                .toInt()
                .coerceIn(50, 100)

        val response =
            DashboardResponse(
                collectiveName = collective.name,
                currentUserName = user.name,
                currentUserXp = user.xp,
                currentUserLevel = user.level,
                currentUserRank = rank,
                currentUserBalance = userBalance,
                completedTasksCount =
                    allTasks
                        .count { it.completed && it.assignee == user.name },
                upcomingTasks =
                    liveTasks
                        .filter { !it.completed }
                        .sortedBy { it.dueDate }
                        .take(3)
                        .map { it.toDto() },
                upcomingEvents =
                    events
                        .filter { it.date >= LocalDate.now() }
                        .sortedBy { it.date }
                        .take(3)
                        .map { it.toDto() },
                recentExpenses =
                    expenses
                        .sortedByDescending { it.date }
                        .take(3)
                        .map { it.toDto() },
                pendingShoppingItems =
                    shoppingItemRepository
                        .findAllByCollectiveCode(collectiveCode)
                        .filter { !it.completed }
                        .take(3)
                        .map { ShoppingItemDto(it.id, it.item, it.addedBy, it.completed) },
                vibeScore = vibeScore,
            )

        return response
    }

    // Live task rows plus archived snapshots of pruned tasks, so every history-dependent
    // stat (leaderboard periods, achievements, fairness) sees the full record even after
    // tasks are deleted 5 days past their due date. Archived entries are detached, read-only
    // TaskItem instances (negative ids) and are never persisted.
    private fun tasksWithHistory(collectiveCode: String): List<TaskItem> =
        taskRepository.findAllByCollectiveCode(collectiveCode) +
            taskHistoryRepository.findAllByCollectiveCode(collectiveCode).map { it.toTaskItem() }

    private fun TaskHistoryEntry.toTaskItem(): TaskItem =
        TaskItem(
            id = -id,
            title = "",
            assignee = assignee,
            collectiveCode = collectiveCode,
            dueDate = dueDate,
            category = category,
            completed = completed,
            completedBy = completedBy,
            completedAt = completedAt,
            xp = xp,
            penaltyXp = penaltyXp,
            recurrenceRule = recurrenceRule,
        )

    private fun buildPeriodStats(
        players: List<LeaderboardPlayerDto>,
        completedTasks: List<TaskItem>,
        allTasks: List<TaskItem>,
        members: List<Member>,
    ): PeriodStatsDto {
        val totalTasks = completedTasks.size
        val totalXp = completedTasks.sumOf { it.xp }
        val avgPerPerson = if (members.isNotEmpty()) totalXp / members.size else 0
        val topContributor = players.firstOrNull()?.name ?: "N/A"

        val bestStreakEntry = players.maxByOrNull { it.streak }
        val bestStreak = bestStreakEntry?.streak ?: 0
        val bestStreakHolder = bestStreakEntry?.name ?: "N/A"

        val totalPenaltyXp = completedTasks.sumOf { it.penaltyXp }

        val lateByMember =
            members.associateWith { m ->
                completedTasks.count { it.assignee == m.name && it.penaltyXp > 0 }
            }
        val mostLateEntry = lateByMember.maxByOrNull { it.value }
        val lateCompletions = mostLateEntry?.value ?: 0
        val lateCompletionsHolder = if (lateCompletions > 0) mostLateEntry?.key?.name ?: "N/A" else "N/A"

        val skippedByMember =
            members.associateWith { m ->
                allTasks.count { it.assignee == m.name && !it.completed && it.dueDate < LocalDate.now() }
            }
        val mostSkippedEntry = skippedByMember.maxByOrNull { it.value }
        val skippedCount = mostSkippedEntry?.value ?: 0
        val skippedHolder = if (skippedCount > 0) mostSkippedEntry?.key?.name ?: "N/A" else "N/A"

        return PeriodStatsDto(
            totalTasks = totalTasks,
            totalXp = totalXp,
            avgPerPerson = avgPerPerson,
            topContributor = topContributor,
            bestStreak = bestStreak,
            bestStreakHolder = bestStreakHolder,
            totalPenaltyXp = totalPenaltyXp,
            lateCompletions = lateCompletions,
            lateCompletionsHolder = lateCompletionsHolder,
            skippedCount = skippedCount,
            skippedHolder = skippedHolder,
        )
    }

    private fun computeStreak(memberTasks: List<TaskItem>): Int {
        val completionDates =
            memberTasks
                .filter { it.completed && it.completedAt != null }
                .map { it.completedAt!!.toLocalDate() }
                .toSortedSet()

        if (completionDates.isEmpty()) return 0

        var current = LocalDate.now()
        if (!completionDates.contains(current)) {
            current = current.minusDays(1)
        }
        if (!completionDates.contains(current)) return 0

        var streak = 0
        while (completionDates.contains(current)) {
            streak++
            current = current.minusDays(1)
        }
        return streak
    }

    private fun buildBadges(
        rank: Int,
        streak: Int,
        level: Int,
        tasksCompleted: Int,
    ): List<String> =
        buildList {
            if (rank == 1) add("TOP")
            if (streak >= 7) add("STREAK")
            if (level >= 5) add("PRO")
            if (tasksCompleted >= 25) add("HERO")
        }

    private fun CustomAchievement.toDto(
        memberTasks: List<TaskItem>,
        member: Member,
        streak: Int,
    ): AchievementDto {
        val progress =
            when (metric) {
                CustomAchievementMetric.TASKS_COMPLETED -> memberTasks.count { it.completed }
                CustomAchievementMetric.XP_EARNED -> member.xp.coerceAtLeast(0)
                CustomAchievementMetric.STREAK_DAYS -> streak
                CustomAchievementMetric.EARLY_COMPLETIONS ->
                    memberTasks.count {
                        it.completed && it.completedAt != null && it.completedAt.toLocalDate().isBefore(it.dueDate)
                    }
                CustomAchievementMetric.ON_TIME_COMPLETIONS ->
                    memberTasks.count {
                        it.completed && it.completedAt != null && !it.completedAt.toLocalDate().isAfter(it.dueDate)
                    }
                CustomAchievementMetric.RECURRING_COMPLETIONS ->
                    memberTasks.count {
                        it.completed && !it.recurrenceRule.isNullOrBlank() && it.recurrenceRule.uppercase() != "NONE"
                    }
                CustomAchievementMetric.CATEGORY_COMPLETIONS ->
                    memberTasks.count { it.completed && it.category == taskCategory }
            }.coerceAtMost(target)

        return AchievementDto(
            id = -id,
            key = "CUSTOM_$id",
            title = title,
            description = description,
            icon = icon,
            unlocked = progress >= target,
            progress = progress,
            total = target,
            custom = true,
            createdBy = createdBy,
        )
    }

    private fun TaskItem.toDto() =
        TaskDto(
            id = id,
            title = title,
            assignee = assignee,
            dueDate = dueDate,
            category = category,
            completed = completed,
            xp = xp,
            recurrenceRule = recurrenceRule,
            penaltyXp = penaltyXp,
        )

    private fun CalendarEvent.toDto() = EventDto(id, title, date, time, endTime, type, organizer, attendees, description)

    private fun Expense.toDto() =
        ExpenseDto(
            id = id,
            description = description,
            amount = amount,
            paidBy = paidBy,
            category = category,
            date = date,
            participantNames = participantNames.sorted(),
        )
}
