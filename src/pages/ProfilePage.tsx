import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  LogOut,
  Trash2,
  ArrowRightLeft,
  Copy,
  Check,
  ChevronDown,
  Bell,
  X,
  Sun,
  Moon,
  Smartphone,
  Globe2,
  Wallet,
  ArrowLeft,
  ScrollText,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  getNotificationPreferences,
  updateNotificationPreference,
  getUserMessage,
} from "../lib/api";
import { qk } from "../lib/queryKeys";
import { useUser, useRealtimeEvent } from "../context/UserContext";
import { translateKey } from "../i18n/helpers";
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

const PROFILE_REFRESH_EVENTS = new Set([
  "TASK_CREATED",
  "TASK_UPDATED",
  "TASK_DELETED",
  "TASK_COMPLETED_LATE",
  "XP_UPDATED",
  "ACHIEVEMENT_CONFIG_UPDATED",
  "HOUSE_RULES_UPDATED",
]);

const STATUS_OPTIONS: { value: MemberStatus; dotClass: string }[] = [
  { value: "ACTIVE", dotClass: "bg-emerald-500" },
  { value: "AWAY", dotClass: "bg-amber-500" },
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
  const { theme, setTheme, resolvedTheme } = useTheme();
  const {
    currentUser,
    setCurrentUser,
    handleLogout,
  } = useUser();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [expandNotifPrefs, setExpandNotifPrefs] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({});
  const [expandInvite, setExpandInvite] = useState(false);
  const [expandPayment, setExpandPayment] = useState(
    // Opened by the economy page's "nobody can pay you back" nudge, which links here with
    // ?section=payment. Collapsed by default otherwise.
    () => new URLSearchParams(window.location.search).get('section') === 'payment',
  );
  const [paymentHandles, setPaymentHandles] = useState<PaymentHandles>({});
  const [paymentSaving, setPaymentSaving] = useState(false);
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
  const queryClient = useQueryClient();

  useEffect(() => {
    setProfileLoadFailed(false);
  }, [name]);

  const houseRuleLines = houseRules?.content
    ? houseRules.content
        .split("\n")
        .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
        .filter((line) => line.length > 0)
    : [];

  const rulesQuery = useQuery({
    queryKey: qk.profileRules(name),
    enabled: !!currentUser?.id,
    queryFn: async () => {
      const collective = await api.get<{ collectiveId: number }>(`/onboarding/collectives/code/${currentUser!.id}`);
      const [rules, quiet] = await Promise.all([
        api.get<HouseRules>(`/collectives/${collective.collectiveId}/rules`),
        api.get<QuietHours>(`/collectives/${collective.collectiveId}/quiet-hours`),
      ]);
      return { collectiveId: collective.collectiveId, rules, quiet };
    },
  });

  useEffect(() => {
    if (!rulesQuery.data) return;
    setCollectiveId(rulesQuery.data.collectiveId);
    setHouseRules(rulesQuery.data.rules);
    setQuietHours(rulesQuery.data.quiet);
  }, [rulesQuery.data]);

  const loadHouseRules = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.profileRules(name) });
  }, [queryClient, name]);

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

  const kudosQuery = useQuery({
    queryKey: qk.profileKudos(name),
    enabled: !!name,
    queryFn: () => api.get<Kudo[]>('/kudos/feed'),
  });

  useEffect(() => {
    if (!kudosQuery.data) return;
    setReceivedKudos(kudosQuery.data.filter((kudo) => kudo.receiver === name).length);
  }, [kudosQuery.data, name]);

  const loadKudos = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.profileKudos(name) });
  }, [queryClient, name]);

  const statsQuery = useQuery({
    queryKey: qk.profileStats(name),
    enabled: !!name,
    queryFn: async () => {
      const [leaderboard, achievements] = await Promise.allSettled([
        api.get<{ players: LeaderboardPlayer[] }>(`/leaderboard?memberName=${encodeURIComponent(name)}&period=OVERALL`),
        api.get<Achievement[]>(`/achievements?memberName=${encodeURIComponent(name)}`),
      ]);
      return { leaderboard, achievements };
    },
  });

  useEffect(() => {
    if (!statsQuery.data) return;
    const { leaderboard, achievements } = statsQuery.data;
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
  }, [statsQuery.data, name]);

  const loadStatsAndAchievements = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.profileStats(name) });
  }, [queryClient, name]);

  const notifPrefsQuery = useQuery({
    queryKey: qk.profileNotifs(name),
    enabled: !!name,
    queryFn: () => getNotificationPreferences(name),
  });

  useEffect(() => {
    if (notifPrefsQuery.data) setNotifPrefs(notifPrefsQuery.data);
    if (notifPrefsQuery.isError) setProfileLoadFailed(true);
  }, [notifPrefsQuery.data, notifPrefsQuery.isError]);

  const householdMembersQuery = useQuery({
    queryKey: qk.members(name),
    enabled: !!name,
    queryFn: () => api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(name)}`),
  });

  useEffect(() => {
    if (householdMembersQuery.data) setHouseholdMembers(householdMembersQuery.data);
    if (householdMembersQuery.isError) setProfileLoadFailed(true);
  }, [householdMembersQuery.data, householdMembersQuery.isError]);

  const paymentHandlesQuery = useQuery({
    queryKey: qk.profilePayments(name),
    enabled: !!name,
    queryFn: () => api.get<PaymentHandles>(`/members/payment-handles?memberName=${encodeURIComponent(name)}`),
  });

  useEffect(() => {
    if (paymentHandlesQuery.data) setPaymentHandles(paymentHandlesQuery.data);
  }, [paymentHandlesQuery.data]);

  useRealtimeEvent(
    (event) => {
      if (PROFILE_REFRESH_EVENTS.has(event.type)) void loadStatsAndAchievements();
      if (event.type === "HOUSE_RULES_UPDATED") void loadHouseRules();
      if (event.type === "KUDOS_CREATED") void loadKudos();
    },
    () => {
      void loadStatsAndAchievements();
      void loadHouseRules();
      void loadKudos();
    },
  );

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
        <h2 className="mt-2 display-md">{t("profile.title")}</h2>
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
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${status.dotClass}`} />
                    {translateKey("common.memberStatus", status.value)}
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
                  className={`pressable-tight grid h-8 w-8 place-items-center rounded-full transition-transform ${active ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`}
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
              className="pressable-tight h-8 w-8 rounded-lg glass flex items-center justify-center disabled:opacity-60"
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
        <Sparkles className="h-6 w-6 shrink-0 text-primary" />
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
                <span
                  aria-label={translateKey("common.memberStatus", member.status)}
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${member.status === "ACTIVE" ? "bg-emerald-500" : "bg-amber-500"}`}
                />
              </span>
            ))}
          </div>
        </div>
      )}

      {houseRules && (
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 dark:bg-accent/20">
              <ScrollText className="h-4 w-4 text-primary dark:text-accent" />
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
              <button onClick={() => void acknowledgeHouseRules()} className="mt-2 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-ink-foreground">
                {t("profile.houseRules.acknowledge")}
              </button>
            </div>
          )}
        </div>
      )}

      {quietHours && (
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 dark:bg-accent/20">
              <Moon className="h-4 w-4 text-primary dark:text-accent" />
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
                <button onClick={() => void saveQuietHours()} className="flex-1 rounded-xl bg-ink py-2 text-sm font-bold text-ink-foreground">{t("quietHours.save")}</button>
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
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold ${violationType === option ? "bg-ink text-ink-foreground" : "text-muted-foreground"}`}
              >
                {t(`profile.violations.types.${option}`)}
              </button>
            ))}
          </div>
          <select
            value={violationRecipient}
            onChange={(event) => setViolationRecipient(event.target.value)}
            className="w-full min-h-[var(--ctl-lg)] rounded-xl border border-border bg-background px-3 py-2 text-sm"
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
            className="w-full min-h-[var(--ctl-lg)] rounded-xl border border-border bg-background px-3 py-2 text-sm"
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
            className="w-full rounded-xl bg-ink py-2 text-sm font-bold text-ink-foreground disabled:opacity-50"
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
          {theme === "system" ? (
            <Smartphone className="h-4 w-4" />
          ) : resolvedTheme === "light" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4 text-secondary" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{t("profile.appearance.title")}</p>
          <p className="text-[10px] text-muted-foreground">{t(`profile.appearance.${theme}`)}</p>
        </div>
        <div className="seg !p-1" role="group" aria-label={t("profile.appearance.toggle")}>
          {(["system", "light", "dark"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setTheme(option)}
              className={`px-2 py-1.5 rounded-lg text-[9px] font-bold ${theme === option ? "bg-ink text-ink-foreground" : "text-muted-foreground"}`}
            >
              {t(`profile.appearance.${option}Label`)}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => window.open('app-settings:', '_system')}
        className="glass rounded-2xl w-full flex items-center gap-3 p-4"
      >
        <div className="h-9 w-9 rounded-xl bg-primary/20 dark:bg-accent/20 flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4 text-primary dark:text-accent" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold">
            {t("profile.notificationPreferences.title")}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t("profile.notificationPreferences.subtitle")}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
      </button>

      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandPayment((value) => !value)}
          className="w-full flex items-center gap-3 p-4"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/20 dark:bg-accent/20 flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4 text-primary dark:text-accent" />
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
                    className="w-full min-h-[var(--ctl-lg)] bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                    className="w-full min-h-[var(--ctl-lg)] bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                    className="w-full min-h-[var(--ctl-lg)] bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                    className="w-full min-h-[var(--ctl-lg)] bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <p className="text-[10px] text-muted-foreground">{t("profile.paymentMethods.hint")}</p>
                <p className="text-[10px] font-medium text-destructive">{t("profile.paymentMethods.securityHint")}</p>
                <button
                  onClick={() => void handleSavePayment()}
                  disabled={paymentSaving}
                  className="w-full gradient-primary rounded-xl py-2 text-sm font-semibold text-ink-foreground flex items-center justify-center gap-2 disabled:opacity-60"
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
                  className="w-full min-h-[var(--ctl-lg)] bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => void handleInvite()}
                  disabled={inviteSaving}
                  className="w-full gradient-primary rounded-xl py-2 text-sm font-semibold text-ink-foreground flex items-center justify-center gap-2 disabled:opacity-60"
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

      <p className="pt-1 pb-2 text-center text-xs text-muted-foreground/70">{t("common.credits")}</p>

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
                <button onClick={() => setShowRulesEditor(false)} aria-label={t("common.close")} className="pressable-tight grid h-9 w-9 place-items-center rounded-full bg-muted">
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
              <button onClick={() => void saveHouseRules()} disabled={!rulesDraft.trim() || rulesSaving} className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-bold text-ink-foreground disabled:opacity-50">
                {rulesSaving ? t("profile.loading.saving") : t("profile.houseRules.publish")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
