import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  ExternalLink,
  Pencil,
  CalendarPlus,
  Copy,
  Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api, API_BASE } from "../lib/api";
import { addEventToDeviceCalendar } from "../lib/deviceCalendar";
import { useUser } from "../context/UserContext";
import {
  formatMonthDay,
  formatMonthYear,
  formatDate,
  formatTime,
  getWeekdayLabels,
  translateKey,
} from "../i18n/helpers";
import { connectCollectiveRealtime } from "../lib/realtime";
import {
  GOOGLE_CALENDAR_MOBILE_RETURN_URL,
  isNativeGoogleCalendarOAuth,
  listenForGoogleCalendarReturn,
  openNativeGoogleCalendarOAuth,
} from "../lib/googleCalendarOAuth";
import type { CalendarEvent, EventType, GuestNotice, HouseCheckin } from "../lib/types";
import { Eyebrow, Fab } from "../components/ui-kit";

const EVENT_TYPES: EventType[] = ["PARTY", "MOVIE", "DINNER", "GAME_NIGHT", "CLEANING", "SPORTS", "BIRTHDAY", "MEETING", "TRIP", "OTHER"];

const typeColors: Record<EventType, string> = {
  PARTY: "bg-secondary",
  MOVIE: "bg-accent",
  DINNER: "bg-destructive",
  GAME_NIGHT: "bg-primary",
  CLEANING: "bg-accent",
  SPORTS: "bg-primary",
  BIRTHDAY: "bg-secondary",
  MEETING: "bg-accent",
  TRIP: "bg-primary",
  OTHER: "bg-primary",
};
const typeEmoji: Record<EventType, string> = {
  PARTY: "🎉",
  MOVIE: "🎬",
  DINNER: "🍝",
  GAME_NIGHT: "🎲",
  CLEANING: "🧹",
  SPORTS: "⚽",
  BIRTHDAY: "🎂",
  MEETING: "📋",
  TRIP: "🧳",
  OTHER: "📌",
};

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [guestNotices, setGuestNotices] = useState<GuestNotice[]>([]);
  const [checkin, setCheckin] = useState<HouseCheckin | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"event" | "guest">("event");
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("12:00");
  const [newEndTime, setNewEndTime] = useState("");
  const [newType, setNewType] = useState<EventType>("OTHER");
  const [overnightGuest, setOvernightGuest] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editType, setEditType] = useState<EventType>("OTHER");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [feedCopied, setFeedCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const name = currentUser?.name ?? "";

  const fetchEvents = async () => {
    if (!name) return;
    const [eventResponse, guestResponse] = await Promise.all([
      api.get<CalendarEvent[]>(`/events?memberName=${encodeURIComponent(name)}`),
      api.get<GuestNotice[]>("/guest-notices"),
    ]);
    setEvents(eventResponse);
    setGuestNotices(guestResponse);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
    if (!name) return;
    if (currentUser) {
      api.get<{ collectiveId: number }>(`/onboarding/collectives/code/${currentUser.id}`)
        .then((collective) => api.post<HouseCheckin>(`/collectives/${collective.collectiveId}/checkins/generate`, {}))
        .then(setCheckin)
        .catch(() => {});
    }
    api
      .get<{ connected: boolean }>(
        `/google-calendar/status?memberName=${encodeURIComponent(name)}`,
      )
      .then((r) => setGoogleConnected(r.connected))
      .catch(() => {});
    api
      .get<{ path: string }>(
        `/events/calendar-feed?memberName=${encodeURIComponent(name)}`,
      )
      .then((r) => setFeedUrl(`${API_BASE}${r.path}`))
      .catch(() => {});
  }, [name]);

  useEffect(
    () => listenForGoogleCalendarReturn(() => setGoogleConnected(true)),
    [],
  );

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (
        ["EVENT_CREATED", "EVENT_DELETED", "EVENT_UPDATED", "GUEST_NOTICE_CREATED"].includes(event.type)
      ) {
        fetchEvents();
      }
    });
    return disconnect;
  }, [name]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
    setSelectedDay(1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
    setSelectedDay(1);
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    if (addMode === "guest") {
      if (!newEndTime) return;
      const created = await api.post<GuestNotice>("/guest-notices", {
        guestName: newTitle,
        date,
        startTime: newTime,
        endTime: newEndTime,
        overnight: overnightGuest,
      });
      setGuestNotices((previous) => [...previous, created]);
      setNewTitle("");
      setNewEndTime("");
      setOvernightGuest(false);
      setShowAdd(false);
      return;
    }
    const created = await api.post<CalendarEvent>("/events", {
      title: newTitle,
      date,
      time: newTime,
      endTime: newEndTime || null,
      type: newType,
      organizer: name,
      attendees: 1,
      syncToGoogle: true,
    });
    setEvents((prev) => [...prev, created]);
    void addEventToDeviceCalendar({
      title: newTitle,
      date,
      time: newTime,
      endTime: newEndTime || null,
    });
    setNewTitle("");
    setNewTime("12:00");
    setNewEndTime("");
    setNewType("OTHER");
    setShowAdd(false);
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/events/${id}`);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const openEdit = (e: CalendarEvent) => {
    setEditingEvent(e);
    setEditTitle(e.title);
    setEditTime(e.time);
    setEditEndTime(e.endTime ?? "");
    setEditType(e.type);
  };

  const handleEditSave = async () => {
    if (!editingEvent || !editTitle.trim()) return;
    const updated = await api.patch<CalendarEvent>(
      `/events/${editingEvent.id}`,
      {
        title: editTitle,
        time: editTime,
        endTime: editEndTime || null,
        type: editType,
      },
    );
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setEditingEvent(null);
  };

  const handleGoogleSync = async () => {
    if (!name) return;
    if (googleConnected) {
      await api.delete(
        `/google-calendar/disconnect?memberName=${encodeURIComponent(name)}`,
      );
      setGoogleConnected(false);
    } else {
      if (isNativeGoogleCalendarOAuth()) {
        const res = await api.get<{ url: string }>(
          `/google-calendar/auth-url?memberName=${encodeURIComponent(name)}&returnUrl=${encodeURIComponent(GOOGLE_CALENDAR_MOBILE_RETURN_URL)}`,
        );
        await openNativeGoogleCalendarOAuth(res.url);
        return;
      }

      const authWindow = window.open("", "_blank");
      try {
        const res = await api.get<{ url: string }>(
          `/google-calendar/auth-url?memberName=${encodeURIComponent(name)}`,
        );
        if (authWindow) {
          authWindow.location.href = res.url;
        } else {
          window.location.href = res.url;
        }
      } catch {
        authWindow?.close();
      }
    }
  };

  const copyFeedUrl = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setFeedCopied(true);
      window.setTimeout(() => setFeedCopied(false), 1500);
    } catch {}
  };

  const today =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  const selectedDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
  const selectedDate = new Date(year, month, selectedDay);
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const dayEvents = events
    .filter((e) => e.date === selectedDateStr)
    .sort((a, b) => a.time.localeCompare(b.time));
  const dayGuests = guestNotices.filter((notice) => notice.date === selectedDateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const eventDays = new Set([...events.map((event) => event.date), ...guestNotices.map((notice) => notice.date), ...(checkin ? [checkin.weekStart] : [])]);
  const weekdayLabels = getWeekdayLabels();
  const selectedDateLabel = t("calendar.dateGroup", {
    relative: selectedDay === today ? t("common.today") : formatMonthDay(selectedDateStr),
    weekday: formatDate(selectedDate, { weekday: "long" }),
  });

  if (loading)
    return (
      <div className="space-y-3 pt-4 animate-pulse">
        <div className="glass rounded-2xl h-64" />
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pt-2"
    >
      {/* Header */}
      <div>
        <Eyebrow>{t("calendar.eyebrow")}</Eyebrow>
        <h2 className="mt-2 font-display text-[2rem] leading-none font-extrabold tracking-[-.04em]">
          {t("calendar.title")}
        </h2>
      </div>

      {checkin && (
        <div className="flex items-center gap-3 rounded-[1.1rem] border border-primary/25 bg-primary/5 p-3">
          <span className="text-xl">💬</span>
          <div>
            <p className="text-sm font-bold">{t("checkin.calendarTitle")}</p>
            <p className="text-[10px] text-muted-foreground">{formatDate(checkin.weekStart)} · {t("checkin.recurring")}</p>
          </div>
        </div>
      )}

      {/* Week calendar */}
      <div className="card !p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-extrabold tracking-[-.02em]">
            {formatMonthYear(year, month)}
          </h3>
          <div className="flex gap-2">
          <button
            onClick={prevMonth}
            aria-label={t("calendar.previousMonth")}
            className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary dark:bg-primary/25 dark:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            aria-label={t("calendar.nextMonth")}
            className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary dark:bg-primary/25 dark:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1">
          {weekdayLabels.map((day) => (
            <p
              key={day}
              className="pb-1 text-center text-[10px] font-bold uppercase tracking-[.04em] text-muted-foreground"
            >
              {day}
            </p>
          ))}
          {weekDates.map((date) => {
            const dateString = toDateString(date);
            const isSelected = dateString === selectedDateStr;
            const isOutsideMonth = date.getMonth() !== month;
            return (
            <button
              key={dateString}
              onClick={() => {
                setYear(date.getFullYear());
                setMonth(date.getMonth());
                setSelectedDay(date.getDate());
              }}
              className={`relative flex aspect-square w-full items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : isOutsideMonth
                    ? "text-muted-foreground/40 hover:bg-muted"
                    : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {date.getDate()}
              {eventDays.has(dateString) && (
                <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? "bg-secondary" : "bg-destructive"}`} />
              )}
            </button>
            );
          })}
        </div>
      </div>

      {/* Google Calendar sync */}
      <button
        onClick={handleGoogleSync}
        className={`flex w-full items-center gap-3 rounded-[1.1rem] border bg-card p-3 transition-colors hover:bg-muted/30 ${googleConnected ? "border-primary/40" : "border-border"}`}
      >
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium">
            {t("calendar.syncGoogleCalendar")}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {googleConnected
              ? t("calendar.syncConnected")
              : t("calendar.syncDisconnected")}
          </p>
        </div>
        {googleConnected && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
            {t("common.connected")}
          </span>
        )}
      </button>

      {/* Subscribe in any calendar app (Apple, Google, Android, Outlook) via an .ics feed */}
      <div className="rounded-[1.1rem] border border-border bg-card p-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <CalendarPlus className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t("calendar.subscribeTitle")}</p>
            <p className="text-[10px] text-muted-foreground">{t("calendar.subscribeSubtitle")}</p>
          </div>
        </div>
        {feedUrl && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                readOnly
                value={feedUrl}
                onFocus={(event) => event.currentTarget.select()}
                className="min-w-0 flex-1 bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground focus:outline-none"
                aria-label={t("calendar.subscribeUrlLabel")}
              />
              <button
                onClick={() => void copyFeedUrl()}
                className="h-9 w-9 shrink-0 rounded-lg glass flex items-center justify-center"
                aria-label={t("common.copy")}
              >
                {feedCopied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
            <a
              href={feedUrl.replace(/^https?:\/\//, "webcal://")}
              className="flex w-full items-center justify-center gap-1.5 gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground"
            >
              <CalendarPlus className="h-4 w-4" /> {t("calendar.subscribeButton")}
            </a>
          </div>
        )}
      </div>

      {/* Events for selected day */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-extrabold tracking-[-.02em]">
            {selectedDateLabel}
          </h3>
        </div>

        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {t("calendar.newEvent")}
                  </p>
                  <button onClick={() => setShowAdd(false)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1">
                  {(["event", "guest"] as const).map((mode) => (
                    <button key={mode} onClick={() => setAddMode(mode)} className={`rounded-lg py-2 text-xs font-bold ${addMode === mode ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
                      {t(`calendar.addModes.${mode}`)}
                    </button>
                  ))}
                </div>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t(addMode === "guest" ? "calendar.guestNamePlaceholder" : "calendar.eventTitlePlaceholder")}
                  className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-muted-foreground">
                      {t("calendar.startTime")}
                    </p>
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-muted-foreground">
                      {t("calendar.endTimeOptional")}
                    </p>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                {addMode === "guest" && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={overnightGuest} onChange={(event) => setOvernightGuest(event.target.checked)} />
                    {t("calendar.guestOvernight")}
                  </label>
                )}
                {addMode === "event" && <div className="flex gap-2">
                  {EVENT_TYPES.map((eventType) => (
                    <button
                      key={eventType}
                      onClick={() => setNewType(eventType)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${newType === eventType ? "gradient-primary text-primary-foreground" : "glass text-muted-foreground"}`}
                    >
                      {typeEmoji[eventType]}{" "}
                      {translateKey("common.eventTypes", eventType)}
                    </button>
                  ))}
                </div>}
                <button
                  onClick={handleAdd}
                  className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground"
                >
                  {t(addMode === "guest" ? "calendar.addGuestNotice" : "calendar.addEvent")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {dayEvents.length === 0 && dayGuests.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("calendar.noEventsForDay")}
          </p>
        )}

        {dayGuests.map((notice) => (
          <div key={`guest-${notice.id}`} className={`event !flex items-center gap-3 !p-3.5 ${notice.overlapsQuietHours ? "border-secondary/60" : ""}`}>
            <span className="text-2xl">🏠</span>
            <div className="min-w-0 flex-1">
              <h4 className="text-[15px] font-bold">{t("calendar.guestVisit", { guest: notice.guestName })}</h4>
              <p className="text-xs text-muted-foreground">{formatTime(notice.startTime)}–{formatTime(notice.endTime)} · {notice.createdBy}</p>
              {notice.overnight && <span className="text-[10px] font-bold text-primary">{t("calendar.guestOvernight")}</span>}
              {notice.overlapsQuietHours && <p className="text-[10px] font-bold text-secondary-foreground">{t("calendar.quietHoursOverlap")}</p>}
            </div>
          </div>
        ))}

        {dayEvents.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="event !flex items-stretch gap-3 !p-3.5"
          >
            <div className="flex w-14 shrink-0 flex-col items-center pt-0.5 text-center">
              <strong className="font-display text-lg leading-none">
                {formatTime(e.time)}
              </strong>
              <span className="mt-2 text-[9px] font-bold uppercase tracking-[.06em] text-muted-foreground">
                {translateKey("common.eventTypes", e.type)}
              </span>
            </div>
            <span className={`w-[3px] shrink-0 rounded-full ${typeColors[e.type]}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-[15px] font-bold leading-snug">{e.title} {typeEmoji[e.type]}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.description || e.organizer}
                  </p>
                </div>
                <button
                  onClick={() => openEdit(e)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                  aria-label={t("calendar.editEvent")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                  aria-label={t("calendar.deleteEvent")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex -space-x-2">
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-primary text-xs font-bold text-primary-foreground">
                  {e.organizer[0]?.toUpperCase()}
                </span>
                {e.attendees > 1 && (
                  <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-accent text-xs font-bold text-accent-foreground">
                    +{e.attendees - 1}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {/* Edit modal */}
        <AnimatePresence>
          {editingEvent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 pb-6 px-4"
              onClick={(ev) => {
                if (ev.target === ev.currentTarget) setEditingEvent(null);
              }}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                className="w-full max-w-md glass rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {t("calendar.editEvent")}
                  </p>
                  <button onClick={() => setEditingEvent(null)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <input
                  value={editTitle}
                  onChange={(ev) => setEditTitle(ev.target.value)}
                  placeholder={t("calendar.eventTitlePlaceholder")}
                  className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-muted-foreground">
                      {t("calendar.startTime")}
                    </p>
                    <input
                      type="time"
                      value={editTime}
                      onChange={(ev) => setEditTime(ev.target.value)}
                      className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] text-muted-foreground">
                      {t("calendar.endTimeOptional")}
                    </p>
                    <input
                      type="time"
                      value={editEndTime}
                      onChange={(ev) => setEditEndTime(ev.target.value)}
                      className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {EVENT_TYPES.map((eventType) => (
                    <button
                      key={eventType}
                      onClick={() => setEditType(eventType)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${editType === eventType ? "gradient-primary text-primary-foreground" : "glass text-muted-foreground"}`}
                    >
                      {typeEmoji[eventType]}{" "}
                      {translateKey("common.eventTypes", eventType)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleEditSave}
                  className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground"
                >
                  {t("calendar.saveChanges")}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!showAdd && <Fab onClick={() => setShowAdd(true)} label={t("calendar.newEvent")} />}
    </motion.div>
  );
}
