import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Mail,
  Key,
  LogOut,
  Trash2,
  ArrowRightLeft,
  Copy,
  Check,
  ChevronDown,
  Settings,
  X,
  Sun,
  Moon,
  Globe2,
  Wallet,
  ArrowLeft,
  ScrollText,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  api,
  getNotificationPreferences,
  updateNotificationPreference,
  getUserMessage,
} from "../lib/api";
import { useUser } from "../context/UserContext";
import { formatDateTime, translateKey } from "../i18n/helpers";
import type {
  AppUser,
  MemberStatus,
  NotificationPreferences,
  LeaderboardPlayer,
  Achievement,
  PaymentHandles,
  HouseRules,
  QuietHours,
  Kudo,
} from "../lib/types";
import { useTheme } from "../context/ThemeContext";
import { Eyebrow } from "../components/ui-kit";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { MEMBER_COLORS, colorForMember } from "../lib/memberColors";
import { connectCollectiveRealtime } from "../lib/realtime";

const STATUS_OPTIONS: { value: MemberStatus; emoji: string }[] = [
  { value: "ACTIVE", emoji: "🟢" },
  { value: "AWAY", emoji: "🟡" },
];

// Mirrors ALL_NOTIFICATION_TYPES in NotificationService.kt so every notification the backend can
// send is toggleable here. Keep the two lists in sync when adding a notification type.
const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED",
  "TASK_DEADLINE_SOON",
  "TASK_OVERDUE",
  "TASK_NUDGE",
  "TASK_FEEDBACK",
  "TASK_COMPLETED_LATE",
  "TASK_OVERDUE_GROUP",
  "TASK_PENALTY_APPLIED",
  "WEEKLY_RECAP",
  "TASK_SWAP_REQUESTED",
  "TASK_SWAP_ACCEPTED",
  "TASK_SWAP_DECLINED",
  "KUDOS_RECEIVED",
  "NEW_MESSAGE",
  "EXPENSE_OWED",
  "EXPENSE_DEADLINE_SOON",
  "EXPENSE_OVERDUE",
  "SHOPPING_ITEM_ADDED",
  "EVENT_ADDED",
  "HOUSE_RULES_UPDATED",
  "GUEST_NOTICE_CREATED",
  "GUEST_QUIET_HOURS_OVERLAP",
  "QUIET_HOURS_VIOLATION",
  "HOUSE_RULE_VIOLATION",
] as const;

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const {
    currentUser,
    setCurrentUser,
    handleLogout,
    notifications,
    notificationsLoading,
    dismissNotification,
    clearAllNotifications,
    markAllNotificationsRead,
  } = useUser();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [expandNotifs, setExpandNotifs] = useState(false);
  const [expandNotifPrefs, setExpandNotifPrefs] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({});
  const [expandInvite, setExpandInvite] = useState(false);
  const [expandPayment, setExpandPayment] = useState(false);
  const [paymentHandles, setPaymentHandles] = useState<PaymentHandles>({});
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [expandPassword, setExpandPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [myStats, setMyStats] = useState<LeaderboardPlayer | null>(null);
  const [achievementsUnlocked, setAchievementsUnlocked] = useState(0);
  const [achievementsTotal, setAchievementsTotal] = useState(0);
  const [householdMembers, setHouseholdMembers] = useState<AppUser[]>([]);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [notifSaving, setNotifSaving] = useState<string | null>(null);
  const [colorSaving, setColorSaving] = useState(false);
  const [copyingCode, setCopyingCode] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [collectiveId, setCollectiveId] = useState<number | null>(null);
  const [houseRules, setHouseRules] = useState<HouseRules | null>(null);
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [rulesDraft, setRulesDraft] = useState("");
  const [rulesSaving, setRulesSaving] = useState(false);
  const [receivedKudos, setReceivedKudos] = useState(0);
  const [quietHours, setQuietHours] = useState<QuietHours | null>(null);
  const [editingQuietHours, setEditingQuietHours] = useState(false);
  const [quietHoursBackup, setQuietHoursBackup] = useState<QuietHours | null>(null);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [violationType, setViolationType] = useState<"QUIET_HOURS" | "HOUSE_RULE">("QUIET_HOURS");
  const [violationRecipient, setViolationRecipient] = useState("ALL");
  const [violationNote, setViolationNote] = useState("");
  const [violationAnonymous, setViolationAnonymous] = useState(false);
  const [violationSaving, setViolationSaving] = useState(false);

  const name = currentUser?.name ?? "";

  const houseRuleLines = houseRules?.content
    ? houseRules.content
        .split("\n")
        .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
        .filter((line) => line.length > 0)
    : [];

  const loadHouseRules = useCallback(async () => {
    if (!currentUser?.id) return;
    const collective = await api.get<{ collectiveId: number }>(`/onboarding/collectives/code/${currentUser.id}`);
    setCollectiveId(collective.collectiveId);
    setHouseRules(await api.get<HouseRules>(`/collectives/${collective.collectiveId}/rules`));
    setQuietHours(await api.get<QuietHours>(`/collectives/${collective.collectiveId}/quiet-hours`));
  }, [currentUser?.id]);

  const saveQuietHours = async () => {
    if (!collectiveId || !quietHours?.canEdit) return;
    setFeedback(null);
    try {
      setQuietHours(await api.patch<QuietHours>(`/collectives/${collectiveId}/quiet-hours`, {
        enabled: quietHours.enabled,
        startTime: quietHours.startTime,
        endTime: quietHours.endTime,
      }));
      setEditingQuietHours(false);
      setFeedback({ type: "success", text: t("profile.feedback.quietHoursSaved") });
    } catch (error: unknown) {
      setFeedback({ type: "error", text: getUserMessage(error, t("profile.errors.quietHoursFailed")) });
    }
  };

  const loadKudos = useCallback(async () => {
    if (!name) return;
    const feed = await api.get<Kudo[]>('/kudos/feed');
    setReceivedKudos(feed.filter((kudo) => kudo.receiver === name).length);
  }, [name]);

  const loadStatsAndAchievements = useCallback(async () => {
    if (!name) return;
    const [leaderboard, achievements] = await Promise.allSettled([
      api.get<{ players: LeaderboardPlayer[] }>(`/leaderboard?memberName=${encodeURIComponent(name)}&period=OVERALL`),
      api.get<Achievement[]>(`/achievements?memberName=${encodeURIComponent(name)}`),
    ]);
    if (leaderboard.status === "fulfilled") {
      setMyStats(leaderboard.value.players.find((player) => player.name === name) ?? null);
    }
    if (achievements.status === "fulfilled") {
      setAchievementsUnlocked(achievements.value.filter((achievement) => achievement.unlocked).length);
      setAchievementsTotal(achievements.value.length);
    }
    if (leaderboard.status === "rejected" || achievements.status === "rejected") {
      setProfileLoadFailed(true);
    }
  }, [name]);

  useEffect(() => {
    if (!name) return;
    setProfileLoadFailed(false);
    void getNotificationPreferences(name)
      .then(setNotifPrefs)
      .catch(() => setProfileLoadFailed(true));
    void api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(name)}`)
      .then(setHouseholdMembers)
      .catch(() => setProfileLoadFailed(true));
    void api.get<PaymentHandles>(`/members/payment-handles?memberName=${encodeURIComponent(name)}`)
      .then(setPaymentHandles)
      .catch(() => {});
    void loadStatsAndAchievements();
    void loadHouseRules().catch(() => setProfileLoadFailed(true));
    void loadKudos().catch(() => setProfileLoadFailed(true));
  }, [name, loadStatsAndAchievements, loadHouseRules, loadKudos]);

  useEffect(() => {
    if (!name) return;
    const refreshEvents = new Set([
      "TASK_CREATED",
      "TASK_UPDATED",
      "TASK_DELETED",
      "TASK_COMPLETED_LATE",
      "XP_UPDATED",
      "ACHIEVEMENT_CONFIG_UPDATED",
      "HOUSE_RULES_UPDATED",
    ]);
    return connectCollectiveRealtime(name, (event) => {
      if (refreshEvents.has(event.type)) void loadStatsAndAchievements();
      if (event.type === "HOUSE_RULES_UPDATED") void loadHouseRules();
      if (event.type === "KUDOS_CREATED") void loadKudos();
    });
  }, [name, loadStatsAndAchievements, loadHouseRules, loadKudos]);

  const saveHouseRules = async () => {
    if (!collectiveId || !rulesDraft.trim() || rulesSaving) return;
    setRulesSaving(true);
    try {
      const saved = await api.put<HouseRules>(`/collectives/${collectiveId}/rules`, { content: rulesDraft });
      setHouseRules(saved);
      setShowRulesEditor(false);
    } finally {
      setRulesSaving(false);
    }
  };

  const acknowledgeHouseRules = async () => {
    if (!collectiveId || !houseRules || houseRules.version === 0) return;
    setHouseRules(await api.post<HouseRules>(`/collectives/${collectiveId}/rules/${houseRules.version}/ack`, {}));
  };

  const handleToggleNotifPref = async (type: string, enabled: boolean) => {
    if (!name || notifSaving) return;
    const previous = notifPrefs;
    const updated = { ...notifPrefs, [type]: enabled };
    setNotifPrefs(updated);
    setNotifSaving(type);
    setFeedback(null);
    try {
      await updateNotificationPreference(name, updated);
      setFeedback({ type: "success", text: t("profile.feedback.preferencesSaved") });
    } catch (error: unknown) {
      setNotifPrefs(previous);
      setFeedback({ type: "error", text: getUserMessage(error, t("profile.errors.preferencesUpdateFailed")) });
    } finally {
      setNotifSaving(null);
    }
  };

  const handleStatusChange = async (status: MemberStatus) => {
    if (!currentUser || statusSaving || currentUser.status === status) return;
    const previous = currentUser;
    setCurrentUser({ ...currentUser, status });
    setStatusSaving(true);
    setFeedback(null);
    try {
      await api.patch("/members/status", { memberName: name, status });
      setFeedback({ type: "success", text: t("profile.feedback.statusSaved") });
    } catch (error: unknown) {
      setCurrentUser(previous);
      setFeedback({ type: "error", text: getUserMessage(error, t("profile.errors.statusUpdateFailed")) });
    } finally {
      setStatusSaving(false);
    }
  };

  const handleColorChange = async (color: string) => {
    if (!currentUser || colorSaving) return;
    const previous = currentUser.color;
    setCurrentUser({ ...currentUser, color });
    setColorSaving(true);
    setFeedback(null);
    try {
      await api.patch("/members/color", { memberName: name, color });
      setFeedback({ type: "success", text: t("profile.feedback.colorSaved") });
    } catch (error: unknown) {
      setCurrentUser({ ...currentUser, color: previous });
      setFeedback({ type: "error", text: getUserMessage(error, t("profile.errors.colorUpdateFailed")) });
    } finally {
      setColorSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentUser?.collectiveCode || inviteSaving) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setFeedback({ type: "error", text: t("profile.errors.invalidEmail") });
      return;
    }
    setInviteSaving(true);
    setFeedback(null);
    try {
      await api.post("/members/invite", {
        email: inviteEmail.trim(),
        collectiveCode: currentUser.collectiveCode,
      });
      setInviteEmail("");
      setInviteSent(true);
      setFeedback({ type: "success", text: t("profile.feedback.invitationSent") });
      setTimeout(() => setInviteSent(false), 3000);
    } catch (error: unknown) {
      setFeedback({ type: "error", text: getUserMessage(error, t("profile.errors.invitationFailed")) });
    } finally {
      setInviteSaving(false);
    }
  };

  const handleReportViolation = async () => {
    if (!collectiveId || violationSaving) return;
    const note = violationNote.trim();
    const typeLabel = t(`profile.violations.types.${violationType}`);
    const message = note
      ? t("profile.violations.chatMessageWithNote", { type: typeLabel, note })
      : t("profile.violations.chatMessage", { type: typeLabel });
    setViolationSaving(true);
    setFeedback(null);
    try {
      await api.post(`/collectives/${collectiveId}/violations`, {
        violationType,
        recipient: violationRecipient === "ALL" ? null : violationRecipient,
        message,
        anonymous: violationAnonymous,
      });
      setViolationNote("");
      setFeedback({ type: "success", text: t("profile.violations.sent") });
    } catch (error: unknown) {
      setFeedback({ type: "error", text: getUserMessage(error, t("profile.violations.failed")) });
    } finally {
      setViolationSaving(false);
    }
  };

  const handleSavePayment = async () => {
    if (!name || paymentSaving) return;
    setPaymentSaving(true);
    setFeedback(null);
    try {
      const saved = await api.patch<PaymentHandles>("/members/payment-handles", {
        memberName: name,
        vipps: paymentHandles.vipps ?? null,
        mobilepay: paymentHandles.mobilepay ?? null,
        paypal: paymentHandles.paypal ?? null,
        bankAccount: paymentHandles.bankAccount ?? null,
      });
      setPaymentHandles(saved);
      setFeedback({ type: "success", text: t("profile.paymentMethods.saved") });
    } catch (error: unknown) {
      setFeedback({ type: "error", text: getUserMessage(error, t("profile.paymentMethods.saveFailed")) });
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleResetPassword = async () => {
    setPwError("");
    if (newPassword.length < 8) {
      setPwError(t("profile.errors.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t("profile.errors.passwordsMismatch"));
      return;
    }
    try {
      setPasswordSaving(true);
      await api.patch(
        `/members/reset-password?memberName=${encodeURIComponent(name)}`,
        { newPassword },
      );
      setNewPassword("");
      setConfirmPassword("");
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (error: unknown) {
      setPwError(
        getUserMessage(error, t("profile.errors.passwordUpdateFailed")),
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!currentUser?.collectiveCode || copyingCode) return;
    setCopyingCode(true);
    setFeedback(null);
    try {
      await navigator.clipboard.writeText(currentUser.collectiveCode);
      setCodeCopied(true);
      setFeedback({ type: "success", text: t("profile.feedback.codeCopied") });
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (error: unknown) {
      setFeedback({ type: "error", text: getUserMessage(error, t("profile.errors.copyFailed")) });
    } finally {
      setCopyingCode(false);
    }
  };

  const handleLeave = async () => {
    if (!currentUser || leaving || !window.confirm(t("profile.leaveConfirm"))) return;
    setLeaving(true);
    setFeedback(null);
    try {
      await api.patch(
        `/members/leave-collective?memberName=${encodeURIComponent(name)}`,
      );
      setCurrentUser({ ...currentUser, collectiveCode: null });
      navigate("/create-household");
    } catch (error: unknown) {
      setFeedback({ type: "error", text: getUserMessage(error, t("profile.errors.leaveFailed")) });
      setLeaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("profile.deleteConfirm"))) return;
    setDeleting(true);
    try {
      await api.delete(`/members/delete?memberName=${encodeURIComponent(name)}`);
      await handleLogout();
      navigate("/login");
    } catch {
      setDeleting(false);
    }
  };

  const doLogout = async () => {
    await handleLogout();
    navigate("/login");
  };

  const unread = notifications.filter((notification) => !notification.read).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pt-4 pb-8"
    >
      <button
        onClick={() => navigate(-1)}
        className="-ml-1 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("common.back")}
      >
        <ArrowLeft className="h-5 w-5" />
        {t("common.back")}
      </button>
      <div>
        <Eyebrow>{t("profile.eyebrow")}</Eyebrow>
        <h2 className="mt-2 font-display text-[2.35rem] font-extrabold leading-none tracking-[-.04em]">{t("profile.title")}</h2>
      </div>
      {profileLoadFailed && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t("profile.errors.partialLoadFailed")}
        </p>
      )}
      {feedback && (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`rounded-xl px-3 py-2 text-xs ${feedback.type === "error" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
        >
          {feedback.text}
        </p>
      )}
      <div className="glass rounded-2xl p-5 glow-primary">
        <div className="flex items-center gap-4">
          <div
            style={{ backgroundColor: colorForMember(name, currentUser?.color) }}
            className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-display font-bold text-white shrink-0"
          >
            {name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-xl font-bold">{name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {currentUser?.email}
            </p>
          </div>
        </div>

        <div className="mt-4" aria-label={t("profile.status.title")}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">
            {t("profile.status.title")}
          </p>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1">
            {STATUS_OPTIONS.map((status) => {
              const selected = currentUser?.status === status.value;
              return (
                <button
                  key={status.value}
                  type="button"
                  disabled={statusSaving}
                  aria-pressed={selected}
                  onClick={() => void handleStatusChange(status.value)}
                  className={`min-h-20 rounded-lg px-3 py-2 text-left transition-all disabled:opacity-60 ${selected ? "bg-card shadow-sm ring-1 ring-primary/30" : "text-muted-foreground hover:bg-card/50"}`}
                >
                  <span className="block text-sm font-semibold">
                    {status.emoji} {translateKey("common.memberStatus", status.value)}
                  </span>
                  <span className="mt-1 block text-[10px] leading-snug">
                    {t(`profile.status.${status.value.toLowerCase()}Description`)}
                  </span>
                </button>
              );
            })}
          </div>
          {statusSaving && <p className="mt-2 text-[10px] text-muted-foreground">{t("profile.status.saving")}</p>}
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground mb-2">
            {t("profile.avatarColor")}
          </p>
          <div className="flex flex-wrap gap-2">
            {MEMBER_COLORS.map((swatch) => {
              const active = colorForMember(name, currentUser?.color) === swatch;
              return (
                <button
                  key={swatch}
                  onClick={() => void handleColorChange(swatch)}
                  disabled={colorSaving}
                  style={{ backgroundColor: swatch }}
                  className={`grid h-8 w-8 place-items-center rounded-full transition-transform ${active ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`}
                  aria-label={swatch}
                >
                  {active && <Check className="h-4 w-4 text-white" />}
                </button>
              );
            })}
          </div>
        </div>

        {currentUser?.collectiveCode && (
          <div className="mt-4 flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
            <div>
              <p className="text-[10px] text-muted-foreground">
                {t("profile.householdCode")}
              </p>
              <p className="font-display font-bold text-sm tracking-widest">
                {currentUser.collectiveCode}
              </p>
            </div>
            <button
              onClick={() => void handleCopyCode()}
              disabled={copyingCode}
              className="h-8 w-8 rounded-lg glass flex items-center justify-center disabled:opacity-60"
              aria-label={t("profile.copyHouseholdCode")}
            >
              {codeCopied ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        )}
      </div>

      {myStats && (
        <div className="glass rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">{myStats.xp}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{t("profile.stats.xp")}</p>
            </div>
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">#{myStats.rank}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{t("profile.stats.rank")}</p>
            </div>
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">{myStats.level}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{t("profile.stats.level")}</p>
            </div>
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">{myStats.tasksCompleted}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{t("profile.stats.tasksDone")}</p>
            </div>
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">{myStats.streak}d</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{t("profile.stats.streak")}</p>
            </div>
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">{achievementsUnlocked}/{achievementsTotal}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{t("profile.stats.achievements")}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card flex items-center gap-3">
        <span className="text-2xl">✨</span>
        <div className="flex-1">
          <p className="text-sm font-semibold">{t("kudos.profileBadge")}</p>
          <p className="text-xs text-muted-foreground">{t("kudos.receivedTotal", { count: receivedKudos })}</p>
        </div>
        <span className="font-display text-xl font-bold text-primary">{receivedKudos}</span>
      </div>

      {householdMembers.length > 0 && (
        <div className="card">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">{t("profile.householdMembers")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {householdMembers.map((member) => (
              <span key={member.id} className="pill pill-pine flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: colorForMember(member.name, member.color) }}
                  className="grid h-5 w-5 place-items-center rounded-full text-[9px] text-white"
                >
                  {member.name[0]?.toUpperCase()}
                </span>
                {member.name}
                <span className="text-[9px]" aria-label={translateKey("common.memberStatus", member.status)}>
                  {member.status === "ACTIVE" ? "🟢" : "🟡"}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {houseRules && (
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20">
              <ScrollText className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("profile.houseRules.title")}</p>
              <p className="text-[10px] text-muted-foreground">
                {houseRules.version > 0 ? t("profile.houseRules.version", { version: houseRules.version }) : t("profile.houseRules.empty")}
              </p>
            </div>
            {houseRules.canEdit && (
              <button
                onClick={() => {
                  setRulesDraft(houseRules.content);
                  setShowRulesEditor(true);
                }}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-bold"
              >
                {houseRules.version > 0 ? t("profile.houseRules.edit") : t("profile.houseRules.create")}
              </button>
            )}
          </div>
          {houseRuleLines.length > 0 && (
            <>
              <ul className="space-y-1.5">
                {(rulesExpanded ? houseRuleLines : houseRuleLines.slice(0, 3)).map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {houseRuleLines.length > 3 && (
                <button
                  onClick={() => setRulesExpanded((value) => !value)}
                  className="flex items-center gap-1 text-xs font-bold text-primary"
                >
                  {rulesExpanded
                    ? t("profile.houseRules.showLess")
                    : t("profile.houseRules.showMore", { count: houseRuleLines.length - 3 })}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${rulesExpanded ? "rotate-180" : ""}`} />
                </button>
              )}
            </>
          )}
          {houseRules.version > 0 && !houseRules.acknowledged && (
            <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-3">
              <p className="text-xs font-semibold">{t("profile.houseRules.ackBanner")}</p>
              <button onClick={() => void acknowledgeHouseRules()} className="mt-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                {t("profile.houseRules.acknowledge")}
              </button>
            </div>
          )}
        </div>
      )}

      {quietHours && (
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20">
              <Moon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("quietHours.title")}</p>
              <p className="text-[10px] text-muted-foreground">
                {quietHours.enabled ? t("quietHours.window", { start: quietHours.startTime, end: quietHours.endTime }) : t("quietHours.disabled")}
              </p>
            </div>
            {quietHours.canEdit && !editingQuietHours && (
              <button
                onClick={() => {
                  setQuietHoursBackup(quietHours);
                  setEditingQuietHours(true);
                }}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-bold"
              >
                {t("quietHours.edit")}
              </button>
            )}
          </div>
          {quietHours.canEdit && editingQuietHours && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={quietHours.enabled}
                  onChange={(event) => setQuietHours({ ...quietHours, enabled: event.target.checked })}
                />
                {t("quietHours.enabledLabel")}
              </label>
              {quietHours.enabled && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" value={quietHours.startTime} onChange={(event) => setQuietHours({ ...quietHours, startTime: event.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                  <input type="time" value={quietHours.endTime} onChange={(event) => setQuietHours({ ...quietHours, endTime: event.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => void saveQuietHours()} className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground">{t("quietHours.save")}</button>
                <button
                  onClick={() => {
                    if (quietHoursBackup) setQuietHours(quietHoursBackup);
                    setEditingQuietHours(false);
                  }}
                  className="flex-1 rounded-xl border border-border py-2 text-sm font-bold"
                >
                  {t("quietHours.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {collectiveId && houseRules && (
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/15">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("profile.violations.title")}</p>
              <p className="text-[10px] text-muted-foreground">{t("profile.violations.subtitle")}</p>
            </div>
          </div>
          <div className="seg !p-1" role="group" aria-label={t("profile.violations.title")}>
            {(["QUIET_HOURS", "HOUSE_RULE"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setViolationType(option)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold ${violationType === option ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {t(`profile.violations.types.${option}`)}
              </button>
            ))}
          </div>
          <select
            value={violationRecipient}
            onChange={(event) => setViolationRecipient(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            aria-label={t("profile.violations.recipientLabel")}
          >
            <option value="ALL">{t("profile.violations.wholeHousehold")}</option>
            {householdMembers
              .filter((member) => member.name !== name)
              .map((member) => (
                <option key={member.id} value={member.name}>
                  {member.name}
                </option>
              ))}
          </select>
          <textarea
            value={violationNote}
            onChange={(event) => setViolationNote(event.target.value)}
            placeholder={t("profile.violations.notePlaceholder")}
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={violationAnonymous}
              onChange={(event) => setViolationAnonymous(event.target.checked)}
            />
            {t("profile.violations.anonymous")}
          </label>
          <button
            onClick={() => void handleReportViolation()}
            disabled={violationSaving}
            className="w-full rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {violationSaving ? t("profile.violations.sending") : t("profile.violations.send")}
          </button>
        </div>
      )}

      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
          <Globe2 className="h-4 w-4 text-accent-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{t("profile.language")}</p>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-secondary/25 flex items-center justify-center shrink-0">
          {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4 text-secondary" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{t("profile.appearance.title")}</p>
          <p className="text-[10px] text-muted-foreground">{t(`profile.appearance.${theme}`)}</p>
        </div>
        <div className="seg !p-1" role="group" aria-label={t("profile.appearance.toggle")}>
          {(["light", "dark", "pink"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setTheme(option)}
              className={`px-2 py-1.5 rounded-lg text-[9px] font-bold ${theme === option ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {t(`profile.appearance.${option}Label`)}
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandNotifs((value) => !value)}
          className="w-full flex items-center gap-3 p-4"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center relative shrink-0">
            <Bell className="h-4 w-4 text-primary" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[9px] text-destructive-foreground font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">{t("profile.notifications.title")}</p>
            <p className="text-[10px] text-muted-foreground">
              {notificationsLoading
                ? t("profile.notifications.loading")
                : unread > 0
                  ? t("profile.notifications.unread", { count: unread })
                  : t("profile.notifications.allCaughtUp")}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expandNotifs ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {expandNotifs && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                <div className="flex items-center gap-3">
                  {unread > 0 && (
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-xs text-primary font-medium"
                    >
                      {t("profile.notifications.markAllAsRead")}
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAllNotifications}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium ml-auto"
                    >
                      {t("header.clearAll")}
                    </button>
                  )}
                </div>
                {notifications.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    {t("profile.notifications.empty")}
                  </p>
                )}
                {notifications.slice(0, 8).map((notification) => (
                  <div
                    key={notification.id}
                    className={`group relative rounded-xl p-2.5 text-xs ${
                      notification.read
                        ? "bg-muted/20"
                        : "bg-primary/10 border border-primary/20"
                    }`}
                  >
                    <button
                      onClick={() => dismissNotification(notification.id)}
                      className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/60"
                      aria-label={t("profile.notifications.dismiss")}
                    >
                      <X className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                    <p className="pr-4">{notification.message}</p>
                    <p className="text-muted-foreground text-[9px] mt-0.5">
                      {formatDateTime(notification.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandNotifPrefs((value) => !value)}
          className="w-full flex items-center gap-3 p-4"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Settings className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">
              {t("profile.notificationPreferences.title")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.notificationPreferences.subtitle")}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expandNotifPrefs ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {expandNotifPrefs && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-1">
                {NOTIFICATION_TYPES.map((type) => {
                  const enabled = notifPrefs[type] !== false;
                  return (
                    <button
                      key={type}
                      onClick={() => void handleToggleNotifPref(type, !enabled)}
                      disabled={notifSaving !== null}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors disabled:opacity-60"
                    >
                      <span className="text-sm text-left">
                        {translateKey("profile.notificationPreferences.types", type)}
                      </span>
                      <div
                        className={`h-5 w-9 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${
                          enabled ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandPayment((value) => !value)}
          className="w-full flex items-center gap-3 p-4"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">
              {t("profile.paymentMethods.title")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.paymentMethods.subtitle")}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expandPayment ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {expandPayment && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                <label className="block space-y-1">
                  <span className="text-xs font-medium">{t("profile.paymentMethods.vippsLabel")}</span>
                  <input
                    value={paymentHandles.vipps ?? ""}
                    onChange={(event) => setPaymentHandles((p) => ({ ...p, vipps: event.target.value }))}
                    placeholder={t("profile.paymentMethods.vippsPlaceholder")}
                    inputMode="tel"
                    autoComplete="off"
                    maxLength={32}
                    className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">{t("profile.paymentMethods.mobilepayLabel")}</span>
                  <input
                    value={paymentHandles.mobilepay ?? ""}
                    onChange={(event) => setPaymentHandles((p) => ({ ...p, mobilepay: event.target.value }))}
                    placeholder={t("profile.paymentMethods.mobilepayPlaceholder")}
                    inputMode="tel"
                    autoComplete="off"
                    maxLength={32}
                    className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">{t("profile.paymentMethods.paypalLabel")}</span>
                  <input
                    value={paymentHandles.paypal ?? ""}
                    onChange={(event) => setPaymentHandles((p) => ({ ...p, paypal: event.target.value }))}
                    placeholder={t("profile.paymentMethods.paypalPlaceholder")}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={64}
                    className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">{t("profile.paymentMethods.bankLabel")}</span>
                  <input
                    value={paymentHandles.bankAccount ?? ""}
                    onChange={(event) => setPaymentHandles((p) => ({ ...p, bankAccount: event.target.value }))}
                    placeholder={t("profile.paymentMethods.bankPlaceholder")}
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={64}
                    className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <p className="text-[10px] text-muted-foreground">{t("profile.paymentMethods.hint")}</p>
                <p className="text-[10px] font-medium text-destructive">{t("profile.paymentMethods.securityHint")}</p>
                <button
                  onClick={() => void handleSavePayment()}
                  disabled={paymentSaving}
                  className="w-full gradient-primary rounded-xl py-2 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {paymentSaving ? t("profile.loading.sending") : t("profile.paymentMethods.save")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandInvite((value) => !value)}
          className="w-full flex items-center gap-3 p-4"
        >
          <div className="h-9 w-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
            <Mail className="h-4 w-4 text-accent" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">
              {t("profile.inviteRoommates.title")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.inviteRoommates.subtitle")}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expandInvite ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {expandInvite && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder={t("profile.inviteRoommates.emailPlaceholder")}
                  type="email"
                  className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => void handleInvite()}
                  disabled={inviteSaving}
                  className="w-full gradient-primary rounded-xl py-2 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {inviteSent ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t("profile.inviteRoommates.sent")}
                    </>
                  ) : (
                    inviteSaving ? t("profile.loading.sending") : t("profile.inviteRoommates.send")
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandPassword((value) => !value)}
          className="w-full flex items-center gap-3 p-4"
        >
          <div className="h-9 w-9 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
            <Key className="h-4 w-4 text-secondary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">
              {t("profile.resetPassword.title")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.resetPassword.subtitle")}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expandPassword ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {expandPassword && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  placeholder={t("profile.resetPassword.newPassword")}
                  className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  placeholder={t("profile.resetPassword.confirmPassword")}
                  className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                <button
                  onClick={() => void handleResetPassword()}
                  disabled={passwordSaving}
                  className="w-full gradient-primary rounded-xl py-2 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {pwSuccess ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t("profile.resetPassword.updated")}
                    </>
                  ) : (
                    passwordSaving ? t("profile.loading.saving") : t("profile.resetPassword.update")
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass rounded-2xl p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t("profile.account")}
        </p>

        <button
          onClick={doLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t("profile.logOut")}</span>
        </button>

        <button
          onClick={() => void handleLeave()}
          disabled={leaving}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors disabled:opacity-60"
        >
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium">{leaving ? t("profile.loading.leaving") : t("profile.leaveHousehold")}</p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.leaveHouseholdSubtitle")}
            </p>
          </div>
        </button>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 transition-colors disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
          <div className="text-left">
            <p className="text-sm font-medium text-destructive">
              {t("profile.deleteAccount")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.deleteAccountSubtitle")}
            </p>
          </div>
        </button>
      </div>

      <AnimatePresence>
        {showRulesEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowRulesEditor(false)}
          >
            <motion.div
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              exit={{ y: 24 }}
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[1.5rem] bg-background p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold">{t("profile.houseRules.editorTitle")}</h3>
                <button onClick={() => setShowRulesEditor(false)} aria-label={t("common.close")} className="grid h-9 w-9 place-items-center rounded-full bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={rulesDraft}
                onChange={(event) => setRulesDraft(event.target.value)}
                rows={10}
                className="mt-4 w-full resize-none rounded-xl border border-border bg-card p-3 text-sm"
                placeholder={t("profile.houseRules.placeholder")}
              />
              <button onClick={() => void saveHouseRules()} disabled={!rulesDraft.trim() || rulesSaving} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
                {rulesSaving ? t("profile.loading.saving") : t("profile.houseRules.publish")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
