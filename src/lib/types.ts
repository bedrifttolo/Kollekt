export type TaskCategory = 'CLEANING' | 'SMALL_CLEANING' | 'VACUUMING' | 'MOPPING' | 'BATHROOM' | 'KITCHEN' | 'LAUNDRY' | 'DISHES' | 'TRASH' | 'DUSTING' | 'WINDOWS' | 'SHOPPING' | 'OTHER';

export interface TaskFeedback {
  id: number;
  author: string | null; // null when anonymous
  message: string;
  anonymous: boolean;
  imageData: string | null;
  imageMimeType: string | null;
  createdAt: string;
}

export interface Task {
  id: number;
  title: string;
  assignee: string;
  dueDate: string;
  category: TaskCategory;
  completed: boolean;
  xp: number;
  penaltyXp: number;
  /**
   * Recurrence rule for the task. Examples: 'NONE', 'DAILY', 'WEEKLY', 'MONTHLY', or RFC 5545 RRULE string.
   * If null or 'NONE', the task does not repeat.
   */
  recurrenceRule: string | null;
  assignmentReason?: string;
  feedbacks: TaskFeedback[];
  completionImageData?: string | null;
  completionImageMime?: string | null;
}

export interface TaskSwapRequest {
  id: number;
  fromUser: string;
  toUser: string;
  taskId: number;
  taskTitle: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  expiresAt: string;
}

export interface HouseCheckin {
  id: number;
  weekStart: string;
  hasResponded: boolean;
  responseCount: number;
  memberCount: number;
}

export interface CheckinResponse {
  id: number;
  author: string | null;
  mood: number;
  issue: string;
  improvement: string;
}

export interface CheckinSummary {
  checkinId: number;
  weekStart: string;
  averageMood: number | null;
  responseCount: number;
  memberCount: number;
  responses: CheckinResponse[];
}

export interface CollectiveDetails {
  id: number;
  name: string;
  address: string | null;
}

export interface HouseRules {
  version: number;
  content: string;
  updatedBy: string | null;
  createdAt: string | null;
  acknowledged: boolean;
  canEdit: boolean;
}

export interface GuestNotice {
  id: number;
  guestName: string;
  date: string;
  startTime: string;
  endTime: string;
  overnight: boolean;
  createdBy: string;
  overlapsQuietHours: boolean;
}

export interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  canEdit: boolean;
}

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';

export interface MaintenanceStatusHistory {
  id: number;
  status: MaintenanceStatus;
  changedBy: string;
  changedAt: string;
}

export interface MaintenanceTicket {
  id: number;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assignee: string | null;
  dueDate: string | null;
  costEstimate: number | null;
  splitParticipants: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
  statusHistory: MaintenanceStatusHistory[];
}

export type KudoType = 'THANK_YOU' | 'CLEANEST' | 'MOST_HELPFUL' | 'PEACEMAKER';

export interface Kudo {
  id: number;
  sender: string;
  receiver: string;
  type: KudoType;
  context: string;
  taskId: number | null;
  taskTitle: string | null;
  createdAt: string;
}

export interface KudosWeeklySummary {
  weekStart: string;
  total: number;
  recipients: Array<{ receiver: string; count: number }>;
}

export interface ShoppingItem {
  id: number;
  item: string;
  addedBy: string;
  completed: boolean;
  staple?: boolean;
}

export type EventType = 'PARTY' | 'MOVIE' | 'DINNER' | 'GAME_NIGHT' | 'CLEANING' | 'SPORTS' | 'BIRTHDAY' | 'MEETING' | 'TRIP' | 'OTHER';

export interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  endTime?: string | null;
  type: EventType;
  organizer: string;
  attendees: number;
  description?: string;
  joining: string[];
  passing: string[];
}

export interface Expense {
  id: number;
  description: string;
  amount: number;
  paidBy: string;
  category: string;
  date: string;
  participantNames: string[];
  deadlineDate?: string;
  recurring?: boolean;
  recurrenceDayOfMonth?: number | null;
}

export interface Balance {
  name: string;
  amount: number;
}

export interface PaymentHandles {
  vipps?: string | null;
  mobilepay?: string | null;
  paypal?: string | null;
  bankAccount?: string | null;
  cardInfo?: string | null;
}

export interface PayOption {
  name: string;
  amount: number;
  handles: PaymentHandles;
}

export interface PantEntry {
  id: number;
  bottles: number;
  amount: number;
  addedBy: string;
  date: string;
}

export interface PantSummary {
  currentAmount: number;
  goalAmount: number;
  entries: PantEntry[];
}

export interface EconomySummary {
  expenses: Expense[];
  balances: Balance[];
  pantSummary: PantSummary;
  payOptions: PayOption[];
  /** Creditor-side mirror of `payOptions` — housemates who still owe you. Optional so the balance
   *  breakdown degrades to its "you owe" half against a backend that predates the field. */
  owedToYou?: Balance[];
}

/** One category's self-set monthly cap. `monthlyLimit: 0` means the household never set one —
 *  the backend always returns all six canonical categories, never a sparse list. */
export interface Budget {
  category: string;
  monthlyLimit: number;
}

export interface SettleUpResponse {
  collectiveCode: string;
  settledBy: string;
  lastExpenseId: number;
  settledAt: string;
}

export interface LeaderboardPlayer {
  rank: number;
  name: string;
  level: number;
  xp: number;
  tasksCompleted: number;
  streak: number;
  badges: string[];
}

export interface PeriodStats {
  totalTasks: number;
  totalXp: number;
  avgPerPerson: number;
  topContributor: string;
  bestStreak: number;
  bestStreakHolder: string;
  totalPenaltyXp: number;
  lateCompletions: number;
  lateCompletionsHolder: string;
  skippedCount: number;
  skippedHolder: string;
}

export interface LeaderboardResponse {
  players: LeaderboardPlayer[];
  periodStats: PeriodStats;
  monthlyPrize?: string;
}

export interface AchievementCatalogItem {
  key: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
}

export interface MemberStats {
  name: string;
  level: number;
  xp: number;
  rank: number;
  streak: number;
  tasksCompleted: number;
  lateCompletions: number;
  skippedTasks: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
}

export interface Achievement {
  id: number;
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  total?: number;
  custom?: boolean;
  createdBy?: string | null;
}

export type CustomAchievementMetric =
  | 'TASKS_COMPLETED'
  | 'XP_EARNED'
  | 'STREAK_DAYS'
  | 'EARLY_COMPLETIONS'
  | 'ON_TIME_COMPLETIONS'
  | 'RECURRING_COMPLETIONS'
  | 'CATEGORY_COMPLETIONS';

export interface DashboardResponse {
  collectiveName: string;
  currentUserName: string;
  currentUserXp: number;
  currentUserLevel: number;
  currentUserRank: number;
  completedTasksCount: number;
  currentUserBalance: number;
  upcomingTasks: Task[];
  upcomingEvents: CalendarEvent[];
  recentExpenses: Expense[];
  pendingShoppingItems: ShoppingItem[];
  vibeScore: number;
  vibeBreakdown: VibeBreakdown;
}

/** Every input behind `vibeScore`, mirroring StatsService.getDashboard's computation — enough to
 *  show, factor by factor, what is currently helping or hurting and what to do about it. */
export interface VibeBreakdown {
  base: number;
  taskCompletionRate: number;
  taskCompletionPoints: number;
  dueTasksThisWeek: number;
  completedDueTasksThisWeek: number;
  activityBonus: number;
  activityBonusCap: number;
  tasksCompletedThisWeek: number;
  planningBonus: number;
  planningBonusCap: number;
  eventsThisWeek: number;
  togethernessBonus: number;
  togethernessBonusCap: number;
  expensesLoggedThisWeek: number;
  moodAdjustment: number;
  weeklyAverageMood?: number | null;
  balancePenalty: number;
  balancePenaltyCap: number;
  balanceSpread: number;
}

export interface DrinkingQuestion {
  text: string;
  type: string;
  targetedPlayer?: string;
}

export type MemberStatus = 'ACTIVE' | 'AWAY' | 'LEFT';

export type LeaderboardPeriod = 'OVERALL' | 'YEAR' | 'MONTH';

export interface Friend {
  name: string;
}

export interface Invitation {
  id: number;
  email: string;
  collectiveCode: string;
  invitedBy: string;
  accepted: boolean;
  acceptedAt?: string | null;
}

export interface AppUser {
  id: number;
  name: string;
  email: string;
  collectiveCode: string | null;
  status: MemberStatus;
  awayUntil?: string | null;
  color?: string | null;
  friends?: Friend[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AppUser;
}

export interface ChatReaction {
  emoji: string;
  users: string[];
}

export interface ChatPollOption {
  id: number;
  text: string;
  users: string[];
}

export interface ChatPoll {
  question: string;
  options: ChatPollOption[];
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_DEADLINE_SOON'
  | 'TASK_OVERDUE'
  | 'NEW_MESSAGE'
  | 'EXPENSE_OWED'
  | 'EXPENSE_DEADLINE_SOON'
  | 'EXPENSE_OVERDUE'
  | 'SHOPPING_ITEM_ADDED'
  | 'EVENT_ADDED'
  | string;

export interface Notification {
  id: number;
  userName: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  read: boolean;
}

export type NotificationPreferences = Record<string, boolean>;

/**
 * The wallpaper behind one chat thread, shared by everyone in it. Every field is null when the
 * thread has no wallpaper — that is a normal state, not an error.
 */
export interface ChatBackground {
  /** A ready-to-render `data:` URL, or null when the thread has no wallpaper. */
  imageUrl: string | null;
  setBy: string | null;
  updatedAt: string | null;
  /** null for the household thread; the other participant for a direct thread. */
  otherName: string | null;
}

export interface ChatMessage {
  id: number;
  sender: string;
  /** NULL = household message; otherwise the member this private message was sent to. */
  recipient?: string | null;
  text: string;
  imageData?: string | null;
  imageMimeType?: string | null;
  imageFileName?: string | null;
  replyToMessageId?: number | null;
  timestamp: string;
  reactions: ChatReaction[];
  poll?: ChatPoll | null;
  pinned?: boolean;
  edited?: boolean;
  deleted?: boolean;
}

/** One row in the chat inbox: the household thread, or a housemate's DM thread. */
export interface ChatThreadSummary {
  /** null = household; otherwise the other party's name (may be a system pseudo-sender). */
  thread: string | null;
  displayName: string;
  isSystem: boolean;
  lastMessageId: number | null;
  lastMessageSender: string | null;
  lastMessagePreview: string | null;
  lastMessageTimestamp: string | null;
  lastMessageDeleted?: boolean;
}

export interface MeetingTopic {
  id: number;
  title: string;
  createdBy: string;
  createdAt: string;
  resolved: boolean;
}

export interface MemberShare {
  name: string;
  completedTasks: number;
  sharePercent: number;
}

export interface Fairness {
  windowDays: number;
  totalTasks: number;
  balancePercent: number;
  shares: MemberShare[];
}

export interface PartyGameParticipant {
  name: string;
  ready: boolean;
  questionCount: number;
}

export interface PartyGameQuestion {
  id: number;
  prompt: string;
  category: string;
}

export interface PartyGameRoom {
  code: string;
  hostName: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  currentQuestionIndex: number;
  participants: PartyGameParticipant[];
  myQuestions: PartyGameQuestion[];
  questions: PartyGameQuestion[];
}

export interface Promotion {
  id: string;
  category: string;
  dateLabel?: string | null;
  title: string;
  body: string;
  location?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

export interface AppVersionInfo {
  latestIosVersion: string;
  iosStoreUrl: string;
  // Optional because a client can outlive the backend it talks to: reading `undefined` and
  // defaulting to "not forced" is survivable, whereas passing it to compareVersions would throw
  // inside the overlay's catch and silently disable the update check entirely.
  minIosVersion?: string;
  latestAndroidVersion?: string;
  androidStoreUrl?: string;
  minAndroidVersion?: string;
}
