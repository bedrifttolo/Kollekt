package com.kollekt.api.dto

import com.kollekt.domain.EventType
import com.kollekt.domain.MemberStatus
import com.kollekt.domain.TaskCategory
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

data class TaskFeedbackDto(
    val id: Long,
    val author: String?,
    val message: String,
    val anonymous: Boolean,
    val imageData: String?,
    val imageMimeType: String?,
    val createdAt: LocalDateTime,
)

data class GiveTaskFeedbackRequest(
    val message: String = "",
    val anonymous: Boolean = false,
    val imageData: String? = null,
    val imageMimeType: String? = null,
)

enum class LeaderboardPeriod {
    OVERALL,
    YEAR,
    MONTH,
}

data class TaskDto(
    val id: Long,
    val title: String,
    val assignee: String,
    val dueDate: LocalDate,
    val category: TaskCategory,
    val completed: Boolean,
    val xp: Int,
    val recurrenceRule: String? = null,
    val penaltyXp: Int = 0,
    val feedbacks: List<TaskFeedbackDto> = emptyList(),
    val completionImageData: String? = null,
    val completionImageMime: String? = null,
)

data class CreateTaskRequest(
    val title: String,
    val assignee: String,
    val dueDate: LocalDate,
    val category: TaskCategory = TaskCategory.OTHER,
    val xp: Int = 10,
    val recurrenceRule: String? = null,
)

data class CompleteTaskRequest(
    val imageData: String? = null,
    val imageMimeType: String? = null,
)

data class CreateTaskSwapRequest(
    val toUser: String,
)

data class UpdateTaskSwapRequest(
    val status: String,
)

data class TaskSwapRequestDto(
    val id: Long,
    val fromUser: String,
    val toUser: String,
    val taskId: Long,
    val taskTitle: String,
    val status: String,
    val expiresAt: Instant,
)

data class CreateCheckinResponseRequest(
    val mood: Int,
    val issue: String,
    val improvement: String,
    val anonymous: Boolean = false,
)

data class HouseCheckinDto(
    val id: Long,
    val weekStart: LocalDate,
    val hasResponded: Boolean,
    val responseCount: Int,
    val memberCount: Int,
)

data class CheckinResponseDto(
    val id: Long,
    val author: String?,
    val mood: Int,
    val issue: String,
    val improvement: String,
)

data class CheckinSummaryDto(
    val checkinId: Long,
    val weekStart: LocalDate,
    val averageMood: Double?,
    val responseCount: Int,
    val memberCount: Int,
    val responses: List<CheckinResponseDto>,
)

data class UpdateHouseRulesRequest(
    val content: String,
)

data class HouseRulesDto(
    val version: Int,
    val content: String,
    val updatedBy: String?,
    val createdAt: LocalDateTime?,
    val acknowledged: Boolean,
    val canEdit: Boolean,
)

data class ReportViolationRequest(
    val violationType: String,
    val recipient: String? = null,
    val message: String,
    val anonymous: Boolean = false,
)

data class ViolationReportDto(
    val recipients: List<String>,
    val chatMessageId: Long,
)

// A single promoted/sponsored card shown in the dashboard slider (Route A: self-served content).
data class PromotionDto(
    val id: String,
    val category: String,
    val dateLabel: String? = null,
    val title: String,
    val body: String,
    val location: String? = null,
    val ctaLabel: String? = null,
    val ctaUrl: String? = null,
)

data class CreateGuestNoticeRequest(
    val guestName: String,
    val date: LocalDate,
    val startTime: LocalTime,
    val endTime: LocalTime,
    val overnight: Boolean = false,
)

data class GuestNoticeDto(
    val id: Long,
    val guestName: String,
    val date: LocalDate,
    val startTime: LocalTime,
    val endTime: LocalTime,
    val overnight: Boolean,
    val createdBy: String,
    val overlapsQuietHours: Boolean,
)

data class UpdateQuietHoursRequest(
    val enabled: Boolean,
    val startTime: LocalTime,
    val endTime: LocalTime,
)

data class QuietHoursDto(
    val enabled: Boolean,
    val startTime: LocalTime,
    val endTime: LocalTime,
    val canEdit: Boolean,
)

data class CreateMaintenanceTicketRequest(
    val title: String,
    val description: String = "",
    val priority: com.kollekt.domain.MaintenancePriority = com.kollekt.domain.MaintenancePriority.MEDIUM,
    val assignee: String? = null,
    val dueDate: LocalDate? = null,
    val costEstimate: Int? = null,
    val splitParticipants: List<String> = emptyList(),
)

data class UpdateMaintenanceTicketRequest(
    val title: String? = null,
    val description: String? = null,
    val priority: com.kollekt.domain.MaintenancePriority? = null,
    val status: com.kollekt.domain.MaintenanceStatus? = null,
    val assignee: String? = null,
    val dueDate: LocalDate? = null,
    val costEstimate: Int? = null,
    val splitParticipants: List<String>? = null,
)

data class MaintenanceStatusHistoryDto(
    val id: Long,
    val status: com.kollekt.domain.MaintenanceStatus,
    val changedBy: String,
    val changedAt: LocalDateTime,
)

data class MaintenanceTicketDto(
    val id: Long,
    val title: String,
    val description: String,
    val priority: com.kollekt.domain.MaintenancePriority,
    val status: com.kollekt.domain.MaintenanceStatus,
    val assignee: String?,
    val dueDate: LocalDate?,
    val costEstimate: Int?,
    val splitParticipants: List<String>,
    val createdBy: String,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
    val overdue: Boolean,
    val statusHistory: List<MaintenanceStatusHistoryDto>,
)

data class CreateKudoRequest(
    val receiver: String,
    val context: String,
    val type: String = "THANK_YOU",
    val taskId: Long? = null,
)

data class KudoDto(
    val id: Long,
    val sender: String,
    val receiver: String,
    val type: String,
    val context: String,
    val taskId: Long?,
    val taskTitle: String?,
    val createdAt: LocalDateTime,
)

data class KudosRecipientSummaryDto(
    val receiver: String,
    val count: Int,
)

data class KudosWeeklySummaryDto(
    val weekStart: LocalDate,
    val total: Int,
    val recipients: List<KudosRecipientSummaryDto>,
)

data class ShoppingItemDto(
    val id: Long,
    val item: String,
    val addedBy: String,
    val completed: Boolean,
    val staple: Boolean = false,
)

data class CreateShoppingItemRequest(
    val item: String,
    val addedBy: String,
    val staple: Boolean = false,
)

data class UpdateShoppingItemRequest(
    val item: String,
)

data class MarkSupplyBoughtRequest(
    val amount: Int,
    val paidBy: String,
    val participantNames: List<String> = emptyList(),
    val date: LocalDate,
    val deadlineDate: LocalDate? = null,
)

data class EventDto(
    val id: Long,
    val title: String,
    val date: LocalDate,
    val time: LocalTime,
    val endTime: LocalTime?,
    val type: EventType,
    val organizer: String,
    val attendees: Int,
    val description: String?,
)

data class CreateEventRequest(
    val title: String,
    val date: LocalDate,
    val time: LocalTime,
    val endTime: LocalTime? = null,
    val type: EventType = EventType.OTHER,
    val organizer: String,
    val attendees: Int = 1,
    val description: String? = null,
    val syncToGoogle: Boolean = false,
)

data class UpdateEventRequest(
    val title: String,
    val time: LocalTime,
    val endTime: LocalTime? = null,
    val type: EventType,
    val description: String? = null,
)

data class MessageDto(
    val id: Long,
    val sender: String,
    val text: String,
    val imageData: String? = null,
    val imageMimeType: String? = null,
    val imageFileName: String? = null,
    val replyToMessageId: Long? = null,
    val timestamp: LocalDateTime,
    val reactions: List<ReactionDto> = emptyList(),
    val poll: PollDto? = null,
    val pinned: Boolean = false,
)

data class PollDto(
    val question: String,
    val options: List<PollOptionDto>,
)

data class PollOptionDto(
    val id: Int,
    val text: String,
    val users: List<String>,
)

data class CreatePollRequest(
    val question: String,
    val options: List<String>,
)

data class VotePollRequest(
    val optionId: Int,
)

data class CreateMessageRequest(
    val sender: String,
    val text: String,
    val replyToMessageId: Long? = null,
)

data class UserDto(
    val id: Long,
    val name: String,
    val email: String = "",
    val collectiveCode: String?,
    val status: MemberStatus = MemberStatus.ACTIVE,
    val awayUntil: LocalDate? = null,
    val color: String? = null,
    val friends: List<FriendDto> = emptyList(),
)

data class FriendDto(
    val name: String,
)

data class CreateUserRequest(
    val name: String,
    val email: String,
    val password: String,
)

data class LoginRequest(
    val name: String,
    val password: String,
)

data class SocialLoginRequest(
    val idToken: String,
    val nonce: String? = null,
    val displayName: String? = null,
)

data class PasswordResetRequest(
    val email: String,
)

data class PasswordResetConfirmRequest(
    val token: String,
    val newPassword: String,
)

data class AuthResponse(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String,
    val expiresIn: Long,
    val user: UserDto,
)

data class RefreshTokenRequest(
    val refreshToken: String,
)

data class LogoutRequest(
    val refreshToken: String? = null,
)

data class CollectiveDto(
    val id: Long,
    val name: String,
    val joinCode: String,
)

data class CreateCollectiveRequest(
    val name: String,
    val address: String? = null,
    val ownerUserId: Long,
    val numRooms: Int,
    val residents: List<String>,
    val rooms: List<RoomRequest>,
)

data class RoomRequest(
    val name: String,
    val minutes: Int,
)

data class JoinCollectiveRequest(
    val userId: Long,
    val joinCode: String,
)

data class CollectiveCodeDto(
    val joinCode: String,
    val collectiveId: Long = 0,
)

data class ExpenseDto(
    val id: Long,
    val description: String,
    val amount: Int,
    val paidBy: String,
    val category: String,
    val date: LocalDate,
    val participantNames: List<String>,
    val deadlineDate: LocalDate? = null,
    val recurring: Boolean = false,
    val recurrenceDayOfMonth: Int? = null,
)

data class CreateExpenseRequest(
    val description: String,
    val amount: Int,
    val paidBy: String,
    val category: String,
    val date: LocalDate,
    val participantNames: List<String> = emptyList(),
    val deadlineDate: LocalDate? = null,
    val recurring: Boolean = false,
    val recurrenceDayOfMonth: Int? = null,
)

data class UpdateExpenseRequest(
    val description: String,
    val amount: Int,
    val category: String,
)

data class PantEntryDto(
    val id: Long,
    val bottles: Int,
    val amount: Int,
    val addedBy: String,
    val date: LocalDate,
)

data class CreatePantEntryRequest(
    val bottles: Int,
    val amount: Int,
    val addedBy: String,
    val date: LocalDate,
)

data class UpdatePantEntryRequest(
    val bottles: Int,
    val amount: Int,
)

data class UpdatePantGoalRequest(
    val memberName: String,
    val goal: Int,
)

data class BalanceDto(
    val name: String,
    val amount: Int,
)

data class LeaderboardPlayerDto(
    val rank: Int,
    val name: String,
    val level: Int,
    val xp: Int,
    val tasksCompleted: Int,
    val streak: Int,
    val badges: List<String>,
)

data class AchievementDto(
    val id: Long,
    val key: String,
    val title: String,
    val description: String,
    val icon: String,
    val unlocked: Boolean,
    val progress: Int?,
    val total: Int?,
    val custom: Boolean = false,
    val createdBy: String? = null,
)

data class CreateCustomAchievementRequest(
    val title: String,
    val description: String,
    val metric: com.kollekt.domain.CustomAchievementMetric,
    val target: Int,
    val taskCategory: TaskCategory? = null,
    val icon: String = "sparkles",
)

data class DashboardResponse(
    val collectiveName: String,
    val currentUserName: String,
    val currentUserXp: Int,
    val currentUserLevel: Int,
    val currentUserRank: Int,
    val completedTasksCount: Int,
    val currentUserBalance: Int,
    val upcomingTasks: List<TaskDto>,
    val upcomingEvents: List<EventDto>,
    val recentExpenses: List<ExpenseDto>,
    val pendingShoppingItems: List<ShoppingItemDto>,
    val vibeScore: Int,
)

data class PeriodStatsDto(
    val totalTasks: Int,
    val totalXp: Int,
    val avgPerPerson: Int,
    val topContributor: String,
    val bestStreak: Int,
    val bestStreakHolder: String,
    val totalPenaltyXp: Int,
    val lateCompletions: Int,
    val lateCompletionsHolder: String,
    val skippedCount: Int,
    val skippedHolder: String,
)

data class LeaderboardResponse(
    val players: List<LeaderboardPlayerDto>,
    val periodStats: PeriodStatsDto,
    val monthlyPrize: String? = null,
)

data class AchievementCatalogItemDto(
    val key: String,
    val title: String,
    val description: String,
    val icon: String,
    val enabled: Boolean,
)

data class UpdateAchievementConfigRequest(
    val enabledKeys: Set<String>,
)

data class MemberStatsDto(
    val name: String,
    val level: Int,
    val xp: Int,
    val rank: Int,
    val streak: Int,
    val tasksCompleted: Int,
    val lateCompletions: Int,
    val skippedTasks: Int,
    val achievementsUnlocked: Int,
    val achievementsTotal: Int,
)

data class MemberShareDto(
    val name: String,
    val completedTasks: Int,
    val sharePercent: Int,
)

data class FairnessDto(
    val windowDays: Int,
    val totalTasks: Int,
    val balancePercent: Int,
    val shares: List<MemberShareDto>,
)

data class WeeklyRecapDto(
    val weekStart: LocalDate,
    val tasksCompleted: Int,
    val topContributor: String?,
    val topContributorTasks: Int,
    val expensesLogged: Int,
    val bestStreak: Int,
    val bestStreakHolder: String?,
)

data class PantSummaryDto(
    val currentAmount: Int,
    val goalAmount: Int,
    val entries: List<PantEntryDto>,
)

data class EconomySummaryDto(
    val expenses: List<ExpenseDto>,
    val balances: List<BalanceDto>,
    val pantSummary: PantSummaryDto,
)

data class SettleUpRequest(
    val memberName: String,
)

data class SettleWithRequest(
    val creditorName: String,
)

data class PayOptionDto(
    val name: String,
    val amount: Int,
    val handles: PaymentHandlesDto = PaymentHandlesDto(),
)

data class PaymentHandlesDto(
    val vipps: String? = null,
    val mobilepay: String? = null,
    val paypal: String? = null,
    val bankAccount: String? = null,
)

data class UpdatePaymentHandlesRequest(
    val memberName: String,
    val vipps: String? = null,
    val mobilepay: String? = null,
    val paypal: String? = null,
    val bankAccount: String? = null,
)

data class SettleUpResponse(
    val collectiveCode: String,
    val settledBy: String,
    val lastExpenseId: Long,
    val settledAt: LocalDateTime,
)

data class MonthlyPrizeRequest(
    val prize: String?,
)

data class ReactionDto(
    val emoji: String,
    val users: List<String>,
)

data class AddReactionRequest(
    val emoji: String,
)

data class RemoveReactionRequest(
    val emoji: String,
)
