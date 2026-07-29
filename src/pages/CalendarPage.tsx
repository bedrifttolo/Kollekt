import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Pencil,
  CalendarPlus,
  Check,
  CircleCheckBig,
  UserX,
  MessageCircle,
  House,
} from "lucide-react";
import { EVENT_TYPE_ICONS } from "../lib/categoryIcons";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE } from "../lib/api";
import { qk } from "../lib/queryKeys";
import { queryClient as sharedQueryClient } from "../lib/queryClient";
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
import type { CalendarEvent, EventType, GuestNotice, HouseCheckin } from "../lib/types";
import { AddSheet, EmptyState, Eyebrow, Fab, OverflowMenu } from "../components/ui-kit";
import { pressable, springSoft } from "../lib/motion";
import { selectionFeedback } from "../lib/haptics";

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
  // Seed from the warm React Query cache so re-entering the tab renders instantly instead
  // of flashing the loading skeleton on every navigation.
  const [events, setEvents] = useState<CalendarEvent[]>(
    () =>
      sharedQueryClient.getQueryData<{ eventResponse: CalendarEvent[]; guestResponse: GuestNotice[] }>(
        qk.calendar(currentUser?.name ?? ""),
      )?.eventResponse ?? [],
  );
  const [guestNotices, setGuestNotices] = useState<GuestNotice[]>(
    () =>
      sharedQueryClient.getQueryData<{ eventResponse: CalendarEvent[]; guestResponse: GuestNotice[] }>(
        qk.calendar(currentUser?.name ?? ""),
      )?.guestResponse ?? [],
  );
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
  const [feedUrl, setFeedUrl] = useState("");
  const [loading, setLoading] = useState(
    () => !sharedQueryClient.getQueryData(qk.calendar(currentUser?.name ?? "")),
  );

  const name = currentUser?.name ?? "";
  const queryClient = useQueryClient();

  // Cached calendar load — instant on re-navigation, refreshed in the background.
  const { data: calendarBundle } = useQuery({
    queryKey: qk.calendar(name),
    enabled: !!name,
    queryFn: async () => {
      const [eventResponse, guestResponse] = await Promise.all([
        api.get<CalendarEvent[]>(`/events?memberName=${encodeURIComponent(name)}`),
        api.get<GuestNotice[]>("/guest-notices"),
      ]);
      return { eventResponse, guestResponse };
    },
  });

  useEffect(() => {
    if (!calendarBundle) return;
    setEvents(calendarBundle.eventResponse);
    setGuestNotices(calendarBundle.guestResponse);
    setLoading(false);
  }, [calendarBundle]);

  // Shares Dashboard's cache entry, so navigating between the two doesn't refire the POST.
  const { data: checkin } = useQuery({
    queryKey: qk.checkin(name),
    enabled: !!currentUser,
    queryFn: async () => {
      const collective = await api.get<{ collectiveId: number }>(`/onboarding/collectives/code/${currentUser!.id}`);
      return api.post<HouseCheckin>(`/collectives/${collective.collectiveId}/checkins/generate`, {});
    },
  });

  const fetchEvents = async () => {
    if (!name) return;
    await queryClient.invalidateQueries({ queryKey: qk.calendar(name) });
  };

  useEffect(() => {
    if (!name) return;
    api
      .get<{ path: string }>(
        `/events/calendar-feed?memberName=${encodeURIComponent(name)}`,
      )
      .then((r) => setFeedUrl(`${API_BASE}${r.path}`))
      .catch(() => {});
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(
      name,
      (event) => {
        if (
          ["EVENT_CREATED", "EVENT_DELETED", "EVENT_UPDATED", "GUEST_NOTICE_CREATED"].includes(event.type)
        ) {
          fetchEvents();
        }
      },
      { onReconnected: () => fetchEvents() },
    );
    return disconnect;
  }, [name]);

  const prevWeek = () => {
    const date = new Date(year, month, selectedDay);
    date.setDate(date.getDate() - 7);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
    setSelectedDay(date.getDate());
  };
  const nextWeek = () => {
    const date = new Date(year, month, selectedDay);
    date.setDate(date.getDate() + 7);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
    setSelectedDay(date.getDate());
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    const tempId = -Date.now();
    if (addMode === "guest") {
      if (!newEndTime) return;
      const body = { guestName: newTitle, date, startTime: newTime, endTime: newEndTime, overnight: overnightGuest };
      const draft = { newTitle, newEndTime, overnightGuest };
      const optimistic: GuestNotice = { id: tempId, ...body, createdBy: name, overlapsQuietHours: false };
      setGuestNotices((previous) => [...previous, optimistic]);
      setNewTitle("");
      setNewEndTime("");
      setOvernightGuest(false);
      setShowAdd(false);
      try {
        const created = await api.post<GuestNotice>("/guest-notices", body);
        setGuestNotices((previous) => previous.map((g) => (g.id === tempId ? created : g)));
      } catch {
        setGuestNotices((previous) => previous.filter((g) => g.id !== tempId));
        setNewTitle(draft.newTitle);
        setNewEndTime(draft.newEndTime);
        setOvernightGuest(draft.overnightGuest);
        setShowAdd(true);
      }
      return;
    }
    const body = {
      title: newTitle,
      date,
      time: newTime,
      endTime: newEndTime || null,
      type: newType,
      organizer: name,
      attendees: 1,
    };
    const draft = { newTitle, newTime, newEndTime, newType };
    const optimistic: CalendarEvent = { id: tempId, ...body, joining: [], passing: [] };
    setEvents((prev) => [...prev, optimistic]);
    void addEventToDeviceCalendar({ title: newTitle, date, time: newTime, endTime: newEndTime || null });
    setNewTitle("");
    setNewTime("12:00");
    setNewEndTime("");
    setNewType("OTHER");
    setShowAdd(false);
    try {
      const created = await api.post<CalendarEvent>("/events", body);
      setEvents((prev) => prev.map((e) => (e.id === tempId ? created : e)));
    } catch {
      setEvents((prev) => prev.filter((e) => e.id !== tempId));
      setNewTitle(draft.newTitle);
      setNewTime(draft.newTime);
      setNewEndTime(draft.newEndTime);
      setNewType(draft.newType);
      setShowAdd(true);
    }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/events/${id}`);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  // Join/pass RSVP. Tapping your current answer again clears it.
  const handleAttendance = async (event: CalendarEvent, status: "JOINING" | "PASSING") => {
    const mine = event.joining.includes(name) ? "JOINING" : event.passing.includes(name) ? "PASSING" : null;
    const updated = await api.post<CalendarEvent>(`/events/${event.id}/attendance`, {
      status: mine === status ? null : status,
    });
    setEvents((prev) => prev.map((e) => (e.id === event.id ? updated : e)));
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
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pt-2"
    >
      {/* Header */}
      <div>
        <Eyebrow>{t("calendar.eyebrow")}</Eyebrow>
        <h2 className="mt-2 display-sm">
          {t("calendar.title")}
        </h2>
      </div>

      {checkin && (
        <div className="flex items-center gap-3 rounded-[1.1rem] border border-primary/25 bg-primary/5 p-3">
          <MessageCircle className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-bold">{t("checkin.calendarTitle")}</p>
            <p className="text-[10px] text-muted-foreground">{formatDate(checkin.weekStart)} · {t("checkin.recurring")}</p>
          </div>
        </div>
      )}

      {/* Week strip. No card chrome and no 7-column grid of square cells: the weekday sits
          directly above its date inside one tall pill, so the row reads as a single scrubber. */}
      <div>
        <div className="flex items-center justify-between px-1">
          <h3 className="font-display text-lg font-extrabold tracking-[-.02em]">
            {formatMonthYear(year, month)}
          </h3>
          <div className="flex gap-1">
            <button
              onClick={prevWeek}
              aria-label={t("calendar.previousMonth")}
              className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextWeek}
              aria-label={t("calendar.nextMonth")}
              className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-1 flex gap-1">
          {weekDates.map((date, index) => {
            const dateString = toDateString(date);
            const isSelected = dateString === selectedDateStr;
            const isOutsideMonth = date.getMonth() !== month;
            const isToday = dateString === toDateString(new Date());
            return (
              <motion.button
                key={dateString}
                onClick={() => {
                  if (isSelected) return;
                  void selectionFeedback();
                  setYear(date.getFullYear());
                  setMonth(date.getMonth());
                  setSelectedDay(date.getDate());
                }}
                aria-pressed={isSelected}
                {...pressable}
                className="relative flex flex-1 flex-col items-center gap-1 rounded-full py-2.5"
                style={{ minHeight: 'var(--ctl-md)' }}
              >
                {/* The selected pill travels between days instead of blinking on and off, so a
                    week's worth of taps reads as one control rather than seven. */}
                {isSelected && (
                  <motion.span
                    layoutId="calendar-day-pill"
                    transition={springSoft}
                    className="absolute inset-0 rounded-full bg-primary"
                  />
                )}
                <span className={`relative z-10 contents ${isSelected ? 'text-primary-foreground' : ''}`}>
                <span
                  className={`text-[10px] font-bold uppercase tracking-[.04em] ${
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {weekdayLabels[index]}
                </span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    isSelected
                      ? ""
                      : isOutsideMonth
                        ? "text-muted-foreground/40"
                        : isToday
                          ? "text-primary"
                          : "text-foreground"
                  }`}
                >
                  {date.getDate()}
                </span>
                {/* Reserve the dot's row on every day so selecting one doesn't shift the strip. */}
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    !eventDays.has(dateString)
                      ? "bg-transparent"
                      : isSelected
                        ? "bg-primary-foreground"
                        : "bg-secondary"
                  }`}
                />
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* One tap subscribes the phone's own calendar (iOS/Android) to the household feed, read-only. */}
      {feedUrl && (
        <a
          href={feedUrl.replace(/^https?:\/\//, "webcal://")}
          className="flex items-center gap-3 rounded-[1.1rem] border border-border bg-card p-2.5 transition-colors hover:bg-muted/30"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15">
            <CalendarPlus className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("calendar.subscribeTitle")}</p>
            <p className="text-[10px] leading-snug text-muted-foreground">{t("calendar.subscribeSubtitle")}</p>
          </div>
          <span className="shrink-0 rounded-lg gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            {t("calendar.subscribeButton")}
          </span>
        </a>
      )}

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
              <AddSheet title={t("calendar.newEvent")} onClose={() => setShowAdd(false)}>
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1">
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
                  <div className="min-w-0 space-y-1">
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
                {addMode === "event" && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {EVENT_TYPES.map((eventType) => {
                    const TypeIcon = EVENT_TYPE_ICONS[eventType];
                    return (
                    <button
                      key={eventType}
                      onClick={() => setNewType(eventType)}
                      className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-medium transition-all ${newType === eventType ? "gradient-primary text-primary-foreground" : "glass text-muted-foreground"}`}
                    >
                      <TypeIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{translateKey("common.eventTypes", eventType)}</span>
                    </button>
                    );
                  })}
                </div>}
                <button
                  onClick={handleAdd}
                  className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground"
                >
                  {t(addMode === "guest" ? "calendar.addGuestNotice" : "calendar.addEvent")}
                </button>
              </AddSheet>
            </motion.div>
          )}
        </AnimatePresence>

        {dayEvents.length === 0 && dayGuests.length === 0 && (
          <EmptyState
            tone="peri"
            icon={<CalendarPlus className="h-6 w-6" />}
            title={t("calendar.noEventsForDay")}
            body={t("calendar.noEventsForDayBody")}
            action={{ label: t("calendar.addEvent"), onClick: () => setShowAdd(true) }}
          />
        )}

        {dayGuests.map((notice) => (
          <div key={`guest-${notice.id}`} className={`event !flex items-center gap-3 !p-3.5 ${notice.overlapsQuietHours ? "border-secondary/60" : ""}`}>
            <House className="h-6 w-6 shrink-0 text-foreground" />
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
                  <h4 className="flex items-center gap-1.5 text-[15px] font-bold leading-snug">
                    {e.title}
                    {(() => {
                      const TypeIcon = EVENT_TYPE_ICONS[e.type];
                      return <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />;
                    })()}
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.description || e.organizer}
                  </p>
                </div>
	                <OverflowMenu
	                  label={t("common.actions")}
	                  actions={[
	                    {
	                      label: t("calendar.editEvent"),
	                      icon: <Pencil className="h-4 w-4" />,
	                      onSelect: () => openEdit(e),
	                    },
	                    {
	                      label: t("calendar.deleteEvent"),
	                      icon: <Trash2 className="h-4 w-4" />,
	                      destructive: true,
	                      onSelect: () => {
	                        void handleDelete(e.id);
	                      },
	                    },
	                  ]}
	                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex -space-x-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-primary text-xs font-bold text-primary-foreground">
                    {e.organizer[0]?.toUpperCase()}
                  </span>
                  {e.joining.filter((member) => member !== e.organizer).slice(0, 3).map((member) => (
                    <span key={member} className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-accent text-xs font-bold text-accent-foreground">
                      {member[0]?.toUpperCase()}
                    </span>
                  ))}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => void handleAttendance(e, "JOINING")}
                    className={`flex min-h-11 items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                      e.joining.includes(name) ? "gradient-primary text-primary-foreground" : "glass text-muted-foreground"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    {t("calendar.attendance.join")}
                  </button>
                  <button
                    onClick={() => void handleAttendance(e, "PASSING")}
                    className={`min-h-11 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                      e.passing.includes(name) ? "bg-muted text-foreground" : "glass text-muted-foreground"
                    }`}
                  >
                    {t("calendar.attendance.pass")}
                  </button>
                </div>
              </div>
              {(e.joining.length > 0 || e.passing.length > 0) && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                  {e.joining.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <CircleCheckBig className="h-3 w-3 shrink-0" />
                      {e.joining.join(", ")}
                    </span>
                  )}
                  {e.joining.length > 0 && e.passing.length > 0 && <span>·</span>}
                  {e.passing.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <UserX className="h-3 w-3 shrink-0" />
                      {e.passing.join(", ")}
                    </span>
                  )}
                </p>
              )}
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
              className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
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
                  <button
                    onClick={() => setEditingEvent(null)}
                    aria-label={t("common.cancel")}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <input
                  value={editTitle}
                  onChange={(ev) => setEditTitle(ev.target.value)}
                  placeholder={t("calendar.eventTitlePlaceholder")}
                  className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1">
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
                  <div className="min-w-0 space-y-1">
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {EVENT_TYPES.map((eventType) => {
                    const TypeIcon = EVENT_TYPE_ICONS[eventType];
                    return (
                    <button
                      key={eventType}
                      onClick={() => setEditType(eventType)}
                      className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-medium transition-all ${editType === eventType ? "gradient-primary text-primary-foreground" : "glass text-muted-foreground"}`}
                    >
                      <TypeIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{translateKey("common.eventTypes", eventType)}</span>
                    </button>
                    );
                  })}
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
      {!showAdd && <Fab tone="peri" onClick={() => setShowAdd(true)} label={t("calendar.newEvent")} />}
    </motion.div>
  );
}
