import {
  useEffect,
  useState,
  useRef,
  Fragment,
  type ChangeEvent,
  type SetStateAction,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../lib/queryKeys';
import { queryClient as sharedQueryClient } from '../lib/queryClient';
import {
  CheckCircle2,
  Package,
  X,
  ShoppingCart,
  Edit3,
  Trash2,
  MessageSquare,
  Clock,
  RotateCcw,
  Zap,
  Image,
  EyeOff,
  Repeat2,
  Wrench,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { api } from '../lib/api';
import { capturePhotoFile, nativeCameraAvailable } from '../lib/camera';
import { useUser, useRealtimeEvent } from '../context/UserContext';
import { tapFeedback } from '../lib/haptics';
import { formatDate, formatDateTime, translateKey } from '../i18n/helpers';
import { EXPENSE_CATEGORIES } from '../lib/expenseStats';
import type { AppUser, Task, ShoppingItem, TaskCategory, TaskSwapRequest, MaintenanceTicket, MaintenancePriority, MaintenanceStatus } from '../lib/types';
import { AddSheet, Avatar, Chip, Eyebrow, Fab, OverflowMenu, ProgressBar, XpBurst } from '../components/ui-kit';
import { PAGE_ACCENTS } from '../lib/pageAccent';
import { pressable, springPop } from '../lib/motion';
import { celebrate } from '../lib/celebrate';
import { DEFAULT_ROOM_ICON as DEFAULT_TASK_ICON, TASK_CATEGORY_ICONS } from '../lib/categoryIcons';

const CATEGORIES: TaskCategory[] = ['CLEANING', 'SMALL_CLEANING', 'VACUUMING', 'MOPPING', 'BATHROOM', 'KITCHEN', 'LAUNDRY', 'DISHES', 'TRASH', 'DUSTING', 'WINDOWS', 'OTHER'];
const RECURRENCE_OPTIONS = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
const TASK_FILTERS = ['ALL', 'MINE', 'TODAY', 'DONE'] as const;
const SHOPPING_SUGGESTIONS = ['toiletPaper', 'dishSoap', 'trashBags', 'laundryDetergent'] as const;

type TaskFilter = (typeof TASK_FILTERS)[number];

function TaskEditor({
  title,
  newTitle,
  setNewTitle,
  newAssignee,
  setNewAssignee,
  members,
  name,
  newDue,
  setNewDue,
  newCategory,
  setNewCategory,
  newRecurrence,
  setNewRecurrence,
  newXp,
  setNewXp,
  onClose,
  onSave,
  saveLabel,
  suggestedAssignee,
}: {
  title: string;
  newTitle: string;
  setNewTitle: (value: string) => void;
  newAssignee: string;
  setNewAssignee: (value: string) => void;
  members: string[];
  name: string;
  newDue: string;
  setNewDue: (value: string) => void;
  newCategory: TaskCategory;
  setNewCategory: (value: TaskCategory) => void;
  newRecurrence: string;
  setNewRecurrence: (value: string) => void;
  newXp: string;
  setNewXp: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
  suggestedAssignee?: string | null;
}) {
  const { t } = useTranslation();
  const xp = Number(newXp);
  const canSave = newTitle.trim().length > 0 && Number.isInteger(xp) && xp >= 1 && xp <= 1000;

  return (
    <AddSheet title={title} onClose={onClose}>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-muted-foreground">{t('tasks.taskTitleLabel')}</span>
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder={t('tasks.taskTitlePlaceholder')}
          className="w-full min-h-[var(--ctl-lg)] bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={(event) => event.key === 'Enter' && canSave && onSave()}
          autoFocus
        />
      </label>
      {/* Assignee as avatars and category as icon chips: both were <select>s, which on a phone
          means a modal picker per field. Tapping the person and the room is the whole flow. */}
      <div className="space-y-1">
        <span className="text-xs font-semibold text-muted-foreground">{t('tasks.assigneeLabel')}</span>
        <div className="flex flex-wrap gap-1.5">
          {(members.length > 0 ? members : [name]).map((member) => (
            <button
              key={member}
              type="button"
              onClick={() => setNewAssignee(member)}
              aria-pressed={newAssignee === member}
              className={`flex min-h-11 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-bold transition-colors ${
                newAssignee === member ? 'bg-ink text-ink-foreground' : 'bg-muted/60 text-muted-foreground'
              }`}
            >
              <Avatar name={member} className="h-8 w-8 text-[11px]" />
              {member}
            </button>
          ))}
        </div>
        {suggestedAssignee && suggestedAssignee !== newAssignee && (
          <button
            type="button"
            onClick={() => setNewAssignee(suggestedAssignee)}
            className="flex items-center gap-1 pt-0.5 text-left text-[11px] font-medium text-primary"
          >
            <Lightbulb className="h-3.5 w-3.5 shrink-0" />
            {t('tasks.fairSuggestion', { name: suggestedAssignee })}
          </button>
        )}
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-muted-foreground">{t('tasks.dueDateLabel')}</span>
        <input
          type="date"
          value={newDue}
          onChange={(event) => setNewDue(event.target.value)}
          className="w-full min-h-[var(--ctl-lg)] bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>

      <div className="space-y-1">
        <span className="text-xs font-semibold text-muted-foreground">{t('tasks.categoryLabel')}</span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((category) => {
            const CategoryIcon = TASK_CATEGORY_ICONS[category] ?? DEFAULT_TASK_ICON;
            const active = newCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setNewCategory(category)}
                aria-pressed={active}
                className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors ${
                  active ? 'bg-ink text-ink-foreground' : 'bg-muted/60 text-muted-foreground'
                }`}
              >
                <CategoryIcon className="h-3.5 w-3.5 shrink-0" />
                {translateKey('common.taskCategories', category)}
              </button>
            );
          })}
        </div>
      </div>

      <label className="space-y-1 block">
        <span className="text-xs font-semibold text-muted-foreground">{t('tasks.recurrenceLabel')}</span>
        <select value={newRecurrence} onChange={(event) => setNewRecurrence(event.target.value)} className="w-full min-h-[var(--ctl-lg)] bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
          {RECURRENCE_OPTIONS.map((recurrence) => <option key={recurrence} value={recurrence}>{translateKey('common.recurrence', recurrence)}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <input
          type="number"
          min={1}
          max={1000}
          value={newXp}
          onChange={(event) => setNewXp(event.target.value)}
          className="w-20 bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-xs text-muted-foreground">{t('tasks.xpReward')}</span>
      </div>
      <button
        onClick={onSave}
        disabled={!canSave}
        className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-ink-foreground disabled:opacity-50"
      >
        {saveLabel}
      </button>
    </AddSheet>
  );
}

function TasksMain() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const queryClient = useQueryClient();
  // Seed from the warm React Query cache so re-entering the tab renders instantly instead
  // of flashing the loading skeleton on every navigation.
  const cachedTaskBundle = () =>
    sharedQueryClient.getQueryData<{
      taskRes: Task[];
      shopRes: ShoppingItem[];
      swapRequestRes: TaskSwapRequest[];
      maintenanceRes: MaintenanceTicket[];
    }>(qk.tasks(currentUser?.name ?? ''));
  const [tasks, setTasks] = useState<Task[]>(() => cachedTaskBundle()?.taskRes ?? []);
  const [shopping, setShopping] = useState<ShoppingItem[]>(() => cachedTaskBundle()?.shopRes ?? []);
  const [swapRequests, setSwapRequests] = useState<TaskSwapRequest[]>(() => cachedTaskBundle()?.swapRequestRes ?? []);
  const [maintenanceTickets, setMaintenanceTickets] = useState<MaintenanceTicket[]>(
    () => cachedTaskBundle()?.maintenanceRes ?? [],
  );
  const [filter, setFilter] = useState<TaskFilter>('ALL');
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'tasks' | 'shopping' | 'maintenance'>(
    searchParams.get('tab') === 'shopping' || searchParams.get('tab') === 'maintenance'
      ? searchParams.get('tab') as 'shopping' | 'maintenance'
      : 'tasks',
  );
  const [showAdd, setShowAdd] = useState(false);
  const [showShoppingAdd, setShowShoppingAdd] = useState(false);
  const [newShoppingName, setNewShoppingName] = useState('');
  const [showMaintenanceAdd, setShowMaintenanceAdd] = useState(false);
  const [maintenanceFilter, setMaintenanceFilter] = useState<'ALL' | MaintenanceStatus>('ALL');
  const [shoppingFilter, setShoppingFilter] = useState<'ALL' | 'TO_BUY' | 'BOUGHT'>('ALL');
  const [newMaintenanceTitle, setNewMaintenanceTitle] = useState('');
  const [newMaintenanceDescription, setNewMaintenanceDescription] = useState('');
  const [newMaintenancePriority, setNewMaintenancePriority] = useState<MaintenancePriority>('MEDIUM');
  const [newMaintenanceAssignee, setNewMaintenanceAssignee] = useState('');
  const [newMaintenanceDue, setNewMaintenanceDue] = useState('');
  const [completingTicket, setCompletingTicket] = useState<MaintenanceTicket | null>(null);
  const [completeCost, setCompleteCost] = useState('');
  const [completeSplit, setCompleteSplit] = useState<string[]>([]);
  const [completeCategory, setCompleteCategory] = useState<string>('Bills');
  const [editingTicketId, setEditingTicketId] = useState<number | null>(null);
  const [editTicketTitle, setEditTicketTitle] = useState('');
  const [editTicketDescription, setEditTicketDescription] = useState('');
  const [editTicketDue, setEditTicketDue] = useState('');
  const [deletingTicketId, setDeletingTicketId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newCategory, setNewCategory] = useState<TaskCategory>('CLEANING');
  const [newXp, setNewXp] = useState('10');
  const [newRecurrence, setNewRecurrence] = useState('NONE');
  const [commentingId, setCommentingId] = useState<number | null>(null);
  const [swappingTaskId, setSwappingTaskId] = useState<number | null>(null);
  const [swapRecipient, setSwapRecipient] = useState('');
  const [commentText, setCommentText] = useState('');
  const [feedbackAnonymous, setFeedbackAnonymous] = useState(false);
  const [feedbackImage, setFeedbackImage] = useState<{
    data: string;
    mimeType: string;
  } | null>(null);
  const feedbackImageRef = useRef<HTMLInputElement>(null);
  const [editingShopId, setEditingShopId] = useState<number | null>(null);
  const [editShopText, setEditShopText] = useState('');
  const [buyingShopId, setBuyingShopId] = useState<number | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [buyPaidBy, setBuyPaidBy] = useState('');
  const [buyParticipants, setBuyParticipants] = useState<string[]>([]);
  const [buyDate, setBuyDate] = useState('');
  const [buyDeadline, setBuyDeadline] = useState('');
  const [buyCategory, setBuyCategory] = useState<string>('Groceries');
  const [loading, setLoading] = useState(() => !cachedTaskBundle());
  // Tracks whether this render followed a real loading state, so the content fade-in below only
  // plays right after a genuine cold load — a warm revisit (loading never true) renders instantly.
  const wasLoadingRef = useRef(loading);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<number>>(new Set());
  // Which task's checkbox is currently flying its "+N XP" chip. One at a time — the chip clears
  // itself after ~900ms via XpBurst's onDone.
  const [xpBurstTaskId, setXpBurstTaskId] = useState<number | null>(null);
  const pendingTaskIdsRef = useRef<Set<number>>(new Set());
  const tasksRef = useRef<Task[]>([]);
  const taskOverridesRef = useRef<Map<number, Task>>(new Map());

  const name = currentUser?.name ?? '';

  const { data: collectiveMembers = [] } = useQuery({
    queryKey: qk.members(name),
    enabled: !!name,
    queryFn: () => api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(name)}`),
  });
  const members = collectiveMembers.map((member) => member.name);
  const memberOptions = members.length > 0 ? members : [name];

  // Fairness nudge: suggest the housemate with the fewest open tasks when creating a task.
  const openTaskCounts = new Map(memberOptions.map((member) => [member, 0]));
  for (const task of tasks) {
    if (!task.completed && openTaskCounts.has(task.assignee)) {
      openTaskCounts.set(task.assignee, (openTaskCounts.get(task.assignee) ?? 0) + 1);
    }
  }
  const suggestedAssignee = memberOptions.length > 1
    ? memberOptions.reduce((best, member) =>
        (openTaskCounts.get(member) ?? 0) < (openTaskCounts.get(best) ?? 0) ? member : best,
      )
    : null;

  const setTasksState = (updater: SetStateAction<Task[]>) => {
    setTasks((prev) => {
      const next =
        typeof updater === 'function'
          ? (updater as (previous: Task[]) => Task[])(prev)
          : updater;
      tasksRef.current = next;
      return next;
    });
  };

  const taskMatchesOverride = (serverTask: Task, localTask: Task) =>
    serverTask.completed === localTask.completed &&
    serverTask.penaltyXp === localTask.penaltyXp &&
    serverTask.xp === localTask.xp &&
    serverTask.title === localTask.title &&
    serverTask.assignee === localTask.assignee &&
    serverTask.dueDate === localTask.dueDate &&
    serverTask.category === localTask.category &&
    serverTask.recurrenceRule === localTask.recurrenceRule;

  const setTaskOverride = (task: Task) => {
    taskOverridesRef.current.set(task.id, task);
  };

  const clearTaskOverride = (taskId: number) => {
    taskOverridesRef.current.delete(taskId);
  };

  const mergeFetchedTasks = (nextTasks: Task[]) => {
    const localTasksById = new Map(tasksRef.current.map((task) => [task.id, task]));

    return nextTasks.map((task) => {
      if (pendingTaskIdsRef.current.has(task.id)) {
        return localTasksById.get(task.id) ?? task;
      }

      const overriddenTask = taskOverridesRef.current.get(task.id);
      if (!overriddenTask) return task;

      if (taskMatchesOverride(task, overriddenTask)) {
        clearTaskOverride(task.id);
        return task;
      }

      return overriddenTask;
    });
  };

  const sortTasks = (nextTasks: Task[]) =>
    [...nextTasks].sort((firstTask, secondTask) => {
      const dueDateOrder = firstTask.dueDate.localeCompare(secondTask.dueDate);
      if (dueDateOrder !== 0) return dueDateOrder;
      return firstTask.id - secondTask.id;
    });

  const upsertTask = (nextTask: Task) => {
    setTasksState((prev) => {
      const existingIndex = prev.findIndex((task) => task.id === nextTask.id);
      if (existingIndex === -1) return sortTasks([...prev, nextTask]);

      const next = [...prev];
      next[existingIndex] = nextTask;
      return sortTasks(next);
    });
  };

  const extractTaskFromRealtimeEvent = (event: { type: string; payload?: unknown }): Task | null => {
    if (event.type === 'TASK_UPDATED') {
      const payload = event.payload as
        | { task?: Task; updatedBy?: string }
        | Task
        | undefined;

      if (payload && typeof payload === 'object' && 'task' in payload && payload.task) {
        return payload.task;
      }

      return (payload as Task | undefined) ?? null;
    }

    return (event.payload as Task | undefined) ?? null;
  };

  // Cached bundle load: served instantly from cache on re-navigation, refetched in the
  // background. Refreshes after mutations happen via queryClient.invalidateQueries below.
  const { data: taskBundle } = useQuery({
    queryKey: qk.tasks(name),
    enabled: !!name,
    queryFn: async () => {
      const [taskRes, shopRes, swapRequestRes, maintenanceRes] = await Promise.all([
        api.get<Task[]>(`/tasks?memberName=${encodeURIComponent(name)}`),
        api.get<ShoppingItem[]>(`/tasks/shopping?memberName=${encodeURIComponent(name)}`),
        api.get<TaskSwapRequest[]>(`/users/${currentUser?.id}/swap-requests`),
        api.get<MaintenanceTicket[]>('/maintenance/tickets'),
      ]);
      return { taskRes, shopRes, swapRequestRes, maintenanceRes };
    },
  });

  // Apply fetched data to local state, preserving optimistic/pending overrides via merge.
  useEffect(() => {
    if (!taskBundle) return;
    setTasksState(mergeFetchedTasks(taskBundle.taskRes));
    setShopping(taskBundle.shopRes);
    setSwapRequests(taskBundle.swapRequestRes);
    setMaintenanceTickets(taskBundle.maintenanceRes);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskBundle]);

  // Refetch the bundle (used after mutations and realtime events).
  const fetchAll = async () => {
    if (!name) return;
    void queryClient.invalidateQueries({ queryKey: qk.dashboard(name) });
    await queryClient.invalidateQueries({ queryKey: qk.tasks(name) });
  };


  useRealtimeEvent(
    (event) => {
      if (event.type === 'TASK_UPDATED') {
        const payload = event.payload as
          | { updatedBy?: string; task?: Task }
          | undefined;
        if (payload?.updatedBy === name) return;
      }

      if (
        event.type === 'TASK_UPDATED' ||
        event.type === 'TASK_CREATED' ||
        event.type === 'TASK_COMPLETED_LATE' ||
        event.type === 'TASK_REGRET' ||
        event.type === 'TASK_FEEDBACK_UPDATED'
      ) {
        const nextTask = extractTaskFromRealtimeEvent(event);
        if (nextTask) upsertTask(nextTask);
        return;
      }

      if (event.type === 'TASK_DELETED') {
        const payload = event.payload as { id?: number } | undefined;
        if (payload?.id !== undefined) {
          setTasksState((prev) => prev.filter((task) => task.id !== payload.id));
        }
        return;
      }

      if (
        [
          'TASK_PENALTY_APPLIED',
          'SHOPPING_UPDATED',
          'SHOPPING_ITEM_CREATED',
          'SHOPPING_ITEM_TOGGLED',
          'SHOPPING_ITEM_DELETED',
          'SHOPPING_ITEM_UPDATED',
          'SHOPPING_ITEM_BOUGHT',
          'MAINTENANCE_UPDATED',
          'MAINTENANCE_DELETED',
          // A housemate's name changed — refetch everything rather than patching assignee/
          // addedBy/createdBy strings in place across tasks, shopping and maintenance.
          'MEMBER_RENAMED',
        ].includes(event.type)
      ) {
        void queryClient.invalidateQueries({ queryKey: qk.members(name) });
        void fetchAll();
      }
    },
    () => void fetchAll(),
  );

  const handleShoppingAdd = async () => {
    if (!newShoppingName.trim()) return;
    const item = newShoppingName.trim();
    const tempId = -Date.now();
    const optimistic: ShoppingItem = { id: tempId, item, addedBy: name, completed: false };
    setShopping((prev) => [...prev, optimistic]);
    setNewShoppingName('');
    setShowShoppingAdd(false);
    try {
      const created = await api.post<ShoppingItem>('/tasks/shopping', { item, addedBy: name });
      setShopping((prev) => prev.map((i) => (i.id === tempId ? created : i)));
    } catch {
      setShopping((prev) => prev.filter((i) => i.id !== tempId));
      setNewShoppingName(item);
      setShowShoppingAdd(true);
    }
  };

  const handleMaintenanceAdd = async () => {
    if (!newMaintenanceTitle.trim()) return;
    // No price is captured here on purpose — the cost is only known once someone marks the
    // ticket repaired, and that dialog is what files it as a shared expense.
    const body = {
      title: newMaintenanceTitle,
      description: newMaintenanceDescription,
      priority: newMaintenancePriority,
      assignee: newMaintenanceAssignee || null,
      dueDate: newMaintenanceDue || null,
    };
    const draft = {
      newMaintenanceTitle, newMaintenanceDescription, newMaintenanceAssignee,
      newMaintenanceDue,
    };
    const tempId = -Date.now();
    const now = new Date().toISOString();
    const optimistic: MaintenanceTicket = {
      id: tempId,
      ...body,
      costEstimate: null,
      splitParticipants: [],
      status: 'OPEN',
      createdBy: name,
      createdAt: now,
      updatedAt: now,
      overdue: false,
      statusHistory: [],
    };
    setMaintenanceTickets((previous) => [...previous, optimistic]);
    setNewMaintenanceTitle('');
    setNewMaintenanceDescription('');
    setNewMaintenanceAssignee('');
    setNewMaintenanceDue('');
    setShowMaintenanceAdd(false);
    try {
      const created = await api.post<MaintenanceTicket>('/maintenance/tickets', body);
      setMaintenanceTickets((previous) => previous.map((m) => (m.id === tempId ? created : m)));
    } catch {
      setMaintenanceTickets((previous) => previous.filter((m) => m.id !== tempId));
      setNewMaintenanceTitle(draft.newMaintenanceTitle);
      setNewMaintenanceDescription(draft.newMaintenanceDescription);
      setNewMaintenanceAssignee(draft.newMaintenanceAssignee);
      setNewMaintenanceDue(draft.newMaintenanceDue);
      setShowMaintenanceAdd(true);
    }
  };

  // Marking a ticket repaired is the only place a price is entered; the amount is then split
  // across the chosen members and filed as an economy expense paid by whoever completed it.
  const handleMaintenanceStatusChange = (ticket: MaintenanceTicket, status: MaintenanceStatus) => {
    if (status === 'DONE' && ticket.status !== 'DONE') {
      setCompleteCost('');
      setCompleteSplit(memberOptions);
      setCompleteCategory('Bills');
      setCompletingTicket(ticket);
    } else {
      void updateMaintenanceTicket(ticket.id, { status });
    }
  };

  const confirmCompleteTicket = async () => {
    if (!completingTicket) return;
    const actualCost = Math.max(0, Math.round(Number(completeCost) || 0));
    await updateMaintenanceTicket(completingTicket.id, {
      status: 'DONE',
      costEstimate: actualCost,
      splitParticipants: actualCost > 0 ? completeSplit : [],
      category: completeCategory,
    });
    setCompletingTicket(null);
    setCompleteCost('');
    setCompleteSplit([]);
  };

  const startEditTicket = (ticket: MaintenanceTicket) => {
    setEditingTicketId(ticket.id);
    setEditTicketTitle(ticket.title);
    setEditTicketDescription(ticket.description);
    setEditTicketDue(ticket.dueDate ?? '');
    setDeletingTicketId(null);
  };

  const saveEditTicket = async () => {
    if (editingTicketId == null || !editTicketTitle.trim()) return;
    await updateMaintenanceTicket(editingTicketId, {
      title: editTicketTitle,
      description: editTicketDescription,
      dueDate: editTicketDue || null,
    });
    setEditingTicketId(null);
  };

  const deleteMaintenanceTicket = async (ticketId: number) => {
    await api.delete(`/maintenance/tickets/${ticketId}`);
    setMaintenanceTickets((tickets) => tickets.filter((ticket) => ticket.id !== ticketId));
    setDeletingTicketId(null);
  };

  const updateMaintenanceTicket = async (ticketId: number, updates: Partial<MaintenanceTicket> & { category?: string }) => {
    const updated = await api.patch<MaintenanceTicket>(`/maintenance/tickets/${ticketId}`, updates);
    setMaintenanceTickets((tickets) => tickets.map((ticket) => ticket.id === ticketId ? updated : ticket));
  };

  const requestTaskSwap = async (taskId: number) => {
    if (!swapRecipient) return;
    await api.post<TaskSwapRequest>(`/tasks/${taskId}/swap-requests`, {
      toUser: swapRecipient,
    });
    setSwappingTaskId(null);
    setSwapRecipient('');
  };

  const resolveTaskSwap = async (
    requestId: number,
    status: 'ACCEPTED' | 'DECLINED',
  ) => {
    await api.patch<TaskSwapRequest>(`/swap-requests/${requestId}`, { status });
    setSwapRequests((requests) => requests.filter((request) => request.id !== requestId));
    if (status === 'ACCEPTED') await fetchAll();
  };

  const updateTaskInPlace = (taskId: number, nextTask: Task) => {
    setTasksState((prev) => prev.map((task) => (task.id === taskId ? nextTask : task)));
  };

  const patchTaskInPlace = (taskId: number, patch: Partial<Task>) => {
    setTasksState((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    );
  };

  const runTaskMutation = async (
    task: Task,
    optimisticPatch: Partial<Task>,
    request: () => Promise<Task>,
  ) => {
    if (pendingTaskIdsRef.current.has(task.id)) return;

    pendingTaskIdsRef.current.add(task.id);
    setPendingTaskIds((prev) => new Set(prev).add(task.id));
    patchTaskInPlace(task.id, optimisticPatch);

    try {
      const updatedTask = await request();
      setTaskOverride(updatedTask);
      updateTaskInPlace(task.id, updatedTask);
      void fetchAll();
    } catch {
      // Roll the optimistic update back; the task snapping to its previous state is the
      // user-visible signal that the change did not stick.
      clearTaskOverride(task.id);
      updateTaskInPlace(task.id, task);
    } finally {
      pendingTaskIdsRef.current.delete(task.id);
      setPendingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const toggleTask = async (task: Task) => {
    await runTaskMutation(
      task,
      { completed: !task.completed },
      () => api.patch<Task>(`/tasks/${task.id}/toggle?memberName=${encodeURIComponent(name)}`),
    );
  };

  const isOverdueTask = (task: Task) => {
    const today = new Date().toISOString().split('T')[0];
    return !task.completed && task.dueDate < today;
  };

  const handlePrimaryToggle = async (task: Task) => {
    if (task.completed) {
      await toggleTask(task);
      return;
    }

    // Completing a chore is the app's most frequent action, so the reward is deliberately quiet:
    // a haptic and the XP chip flying to the meter, no confetti. celebrate('task-complete') is the
    // haptic-only recipe for exactly this reason — see src/lib/celebrate.ts.
    celebrate('task-complete');
    setXpBurstTaskId(task.id);

    if (isOverdueTask(task)) {
      if ((task.penaltyXp ?? 0) < 0) {
        await completeMissedTask(task);
      } else {
        await markLate(task);
      }
      return;
    }

    await toggleTask(task);
  };

  const markLate = async (task: Task) => {
    await runTaskMutation(
      task,
      { completed: true },
      () => api.post<Task>(`/tasks/${task.id}/regret?memberName=${encodeURIComponent(name)}`, {}),
    );
  };

  const completeMissedTask = async (task: Task) => {
    await runTaskMutation(
      task,
      { completed: true },
      () =>
        api.post<Task>(
          `/tasks/${task.id}/regret-missed?memberName=${encodeURIComponent(name)}`,
          {},
        ),
    );
  };

  const deleteTask = async (taskId: number) => {
    await api.delete(`/tasks/${taskId}?memberName=${encodeURIComponent(name)}`);
    setTasksState((prev) => prev.filter((task) => task.id !== taskId));
    void fetchAll();
  };

  const startEdit = (task: Task) => {
    setShowAdd(false);
    setEditingId(task.id);
    setNewTitle(task.title);
    setNewAssignee(task.assignee);
    setNewDue(task.dueDate);
    setNewCategory(task.category);
    setNewXp(task.xp.toString());
    setNewRecurrence(task.recurrenceRule ?? 'NONE');
  };

  const resetForm = () => {
    setNewTitle('');
    setNewAssignee(name);
    setNewDue('');
    setNewCategory('CLEANING');
    setNewXp('10');
    setNewRecurrence('NONE');
    setShowAdd(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!newTitle.trim()) return;
    const body = {
      title: newTitle,
      assignee: newAssignee || name,
      dueDate: newDue || new Date().toISOString().split('T')[0],
      category: newCategory,
      xp: parseInt(newXp, 10) || 10,
      recurrenceRule: newRecurrence === 'NONE' ? null : newRecurrence,
    };

    if (editingId) {
      await api.patch(`/tasks/${editingId}?memberName=${encodeURIComponent(name)}`, body);
      setTasksState((prev) =>
        prev.map((task) => (task.id === editingId ? { ...task, ...body } : task)),
      );
      resetForm();
      void fetchAll();
      return;
    }

    // Optimistic create: show the task immediately and close the form, then swap the
    // temp row for the server's version. Rolls back and restores the draft on failure.
    const draft = { newTitle, newAssignee, newDue, newCategory, newXp, newRecurrence };
    const tempId = -Date.now();
    const optimistic: Task = {
      id: tempId,
      title: body.title,
      assignee: body.assignee,
      dueDate: body.dueDate,
      category: body.category,
      completed: false,
      xp: body.xp,
      penaltyXp: 0,
      recurrenceRule: body.recurrenceRule,
      feedbacks: [],
    };
    setTasksState((prev) => sortTasks([...prev, optimistic]));
    resetForm();
    try {
      const created = await api.post<Task>('/tasks', body);
      // Drop the temp row and any copy a realtime TASK_CREATED already added.
      setTasksState((prev) => sortTasks([...prev.filter((t) => t.id !== tempId && t.id !== created.id), created]));
      void fetchAll();
    } catch {
      setTasksState((prev) => prev.filter((t) => t.id !== tempId));
      setNewTitle(draft.newTitle);
      setNewAssignee(draft.newAssignee);
      setNewDue(draft.newDue);
      setNewCategory(draft.newCategory);
      setNewXp(draft.newXp);
      setNewRecurrence(draft.newRecurrence);
      setShowAdd(true);
    }
  };

  const readFeedbackFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setFeedbackImage({
        data: (reader.result as string).split(',')[1],
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFeedbackImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) readFeedbackFile(file);
  };

  const pickFeedbackImage = async () => {
    if (nativeCameraAvailable()) {
      const file = await capturePhotoFile();
      if (file) readFeedbackFile(file);
    } else {
      feedbackImageRef.current?.click();
    }
  };

  const resetFeedbackComposer = () => {
    setCommentText('');
    setFeedbackAnonymous(false);
    setFeedbackImage(null);
    if (feedbackImageRef.current) feedbackImageRef.current.value = '';
  };

  const removeFeedbackImage = () => {
    setFeedbackImage(null);
    if (feedbackImageRef.current) feedbackImageRef.current.value = '';
  };

  const addFeedback = async (taskId: number) => {
    if (!commentText.trim() && !feedbackImage) return;
    await api.patch(`/tasks/${taskId}/feedback?memberName=${encodeURIComponent(name)}`, {
      message: commentText.trim(),
      anonymous: feedbackAnonymous,
      imageData: feedbackImage?.data ?? null,
      imageMimeType: feedbackImage?.mimeType ?? null,
    });
    resetFeedbackComposer();
    setCommentingId(null);
    await fetchAll();
  };

  const deleteShopItem = async (itemId: number) => {
    await api.delete(`/tasks/shopping/${itemId}?memberName=${encodeURIComponent(name)}`);
    setShopping((prev) => prev.filter((item) => item.id !== itemId));
  };

  const toggleShopItem = async (itemId: number) => {
    await api.patch(`/tasks/shopping/${itemId}/toggle?memberName=${encodeURIComponent(name)}`);
    setShopping((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const openBuyForm = (item: ShoppingItem) => {
    setEditingShopId(null);
    setBuyingShopId(item.id);
    setBuyAmount('');
    setBuyPaidBy(name);
    setBuyParticipants(memberOptions);
    setBuyDate(new Date().toISOString().split('T')[0]);
    setBuyDeadline('');
    setBuyCategory('Groceries');
  };

  const toggleBuyParticipant = (member: string) => {
    setBuyParticipants((prev) =>
      prev.includes(member)
        ? prev.filter((value) => value !== member)
        : [...prev, member],
    );
  };

  const submitBought = async (itemId: number) => {
    const amount = parseInt(buyAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0 || buyParticipants.length === 0) return;
    await api.post(
      `/tasks/shopping/${itemId}/bought?memberName=${encodeURIComponent(name)}`,
      {
        amount,
        paidBy: buyPaidBy || name,
        participantNames: buyParticipants,
        date: buyDate,
        category: buyCategory,
        ...(buyDeadline ? { deadlineDate: buyDeadline } : {}),
      },
    );
    setBuyDeadline('');
    setBuyingShopId(null);
    await fetchAll();
  };

  const startEditShop = (item: ShoppingItem) => {
    setBuyingShopId(null);
    setEditingShopId(item.id);
    setEditShopText(item.item);
  };

  const saveEditShop = async (itemId: number) => {
    if (!editShopText.trim()) return;
    const updated = await api.patch<ShoppingItem>(
      `/tasks/shopping/${itemId}?memberName=${encodeURIComponent(name)}`,
      { item: editShopText },
    );
    setShopping((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
    setEditingShopId(null);
    setEditShopText('');
  };

  const today = new Date().toISOString().split('T')[0];
  const completedRetentionStart = new Date();
  completedRetentionStart.setDate(completedRetentionStart.getDate() - 7);
  const completedRetentionDate = completedRetentionStart.toISOString().split('T')[0];
  const currentTasks = tasks.filter((task) => !task.completed || task.dueDate >= completedRetentionDate);

  const filteredTasks = tasks
    .filter((task) => {
      if (filter === 'DONE') {
        if (!task.completed) return false;
        return task.dueDate >= completedRetentionDate;
      }
      if (filter === 'MINE') return task.assignee === name && !task.completed;
      if (filter === 'TODAY') return task.dueDate === today && !task.completed;
      return !task.completed;
    })
    .sort((firstTask, secondTask) => {
      const dueDateOrder = firstTask.dueDate.localeCompare(secondTask.dueDate);
      if (dueDateOrder !== 0) return dueDateOrder;
      return firstTask.id - secondTask.id;
    });

  if (loading) {
    wasLoadingRef.current = true;
    return (
      <div className="space-y-4 pt-4">
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded-full bg-muted/30" />
          <div className="h-7 w-40 animate-pulse rounded-lg bg-muted/30" />
        </div>
        <div className="h-12 animate-pulse rounded-[--r-lg] bg-muted/20" />
        <div className="h-32 animate-pulse rounded-[--r-xl] bg-muted/20" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[--r-lg] bg-muted/20" />
          ))}
        </div>
      </div>
    );
  }
  const justFinishedLoading = wasLoadingRef.current;
  wasLoadingRef.current = false;

  const completedCount = currentTasks.filter((task) => task.completed).length;
  const taskTotal = currentTasks.length;
  const completionPercent = taskTotal === 0 ? 0 : (completedCount / taskTotal) * 100;

  const shoppingToBuy = shopping.filter((item) => !item.completed).length;
  const shoppingBought = shopping.length - shoppingToBuy;
  const shoppingPercent = shopping.length === 0 ? 0 : (shoppingBought / shopping.length) * 100;
  const filteredShopping = shopping.filter((item) =>
    shoppingFilter === 'ALL' ? true : shoppingFilter === 'TO_BUY' ? !item.completed : item.completed,
  );

  const maintenanceOpen = maintenanceTickets.filter((ticket) => ticket.status !== 'DONE').length;
  const maintenanceDone = maintenanceTickets.length - maintenanceOpen;
  const maintenanceOverdue = maintenanceTickets.filter((ticket) => ticket.overdue).length;
  const maintenancePercent = maintenanceTickets.length === 0 ? 0 : (maintenanceDone / maintenanceTickets.length) * 100;

  return (
    <motion.div
      initial={justFinishedLoading ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      className="space-y-4 pt-4"
    >
      <div>
        <Eyebrow accent={PAGE_ACCENTS['/tasks']}>{t('tasks.eyebrow')}</Eyebrow>
        <h2 className="mt-2 display-md">{t('tasks.heading')}</h2>
      </div>

      <div className="seg">
        {(['tasks', 'shopping', 'maintenance'] as const).map((value) => {
          const TabIcon = value === 'tasks' ? CheckCircle2 : value === 'shopping' ? ShoppingCart : Wrench;
          return (
            <button
              key={value}
              onClick={() => { setTab(value); setShowAdd(false); setShowShoppingAdd(false); setShowMaintenanceAdd(false); }}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg py-2.5 text-sm font-semibold transition-all ${
                tab === value
                  ? 'bg-ink text-ink-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <TabIcon className="h-4 w-4 shrink-0" />
              {t(`tasks.tabs.${value}`)}
            </button>
          );
        })}
      </div>

      {tab === 'tasks' && (
        <div className="househero hero-ink">
          <p className="text-xs font-bold uppercase tracking-[.15em] text-ink-foreground/65">{t('tasks.progressLabel')}</p>
          <p className="bignum mt-3">{completedCount}<span className="text-[var(--tone-leaf)]">/{taskTotal}</span> <span className="text-2xl tracking-normal">{t('tasks.done')}</span></p>
          <p className="mt-2 text-sm text-ink-foreground/70">{t('tasks.remaining', { count: Math.max(0, taskTotal - completedCount) })}</p>
          <ProgressBar value={completionPercent} className="mt-4 bg-ink-foreground/20" fillClassName="bg-[var(--tone-leaf)]" />
        </div>
      )}

      {!showAdd && !showShoppingAdd && !showMaintenanceAdd && (
        <Fab
          onClick={() => {
            if (tab === 'tasks') { resetForm(); setShowAdd(true); }
            else if (tab === 'shopping') setShowShoppingAdd(true);
            else setShowMaintenanceAdd(true);
          }}
          label={tab === 'tasks' ? t('tasks.addTask') : tab === 'shopping' ? t('tasks.addSupply') : t('tasks.maintenance.addTicket')}
        />
      )}

      <AnimatePresence>
        {showShoppingAdd && tab === 'shopping' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <AddSheet title={t('tasks.addSupply')} onClose={() => setShowShoppingAdd(false)}>
              <input
                value={newShoppingName}
                onChange={(e) => setNewShoppingName(e.target.value)}
                placeholder={t('tasks.supplyNamePlaceholder')}
                className="w-full min-h-[var(--ctl-lg)] bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && void handleShoppingAdd()}
                autoFocus
              />
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t('tasks.shoppingSuggestions')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {SHOPPING_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setNewShoppingName(t(`tasks.shoppingTemplates.${suggestion}`))}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    >
                      {t(`tasks.shoppingTemplates.${suggestion}`)}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => void handleShoppingAdd()}
                disabled={!newShoppingName.trim()}
                className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-ink-foreground disabled:opacity-50"
              >
                {t('tasks.addSupply')}
              </button>
            </AddSheet>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMaintenanceAdd && tab === 'maintenance' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <AddSheet title={t('tasks.maintenance.newTicket')} onClose={() => setShowMaintenanceAdd(false)}>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.titleLabel')}</span>
                <input value={newMaintenanceTitle} onChange={(event) => setNewMaintenanceTitle(event.target.value)} placeholder={t('tasks.maintenance.titlePlaceholder')} autoFocus className="w-full min-h-[var(--ctl-lg)] rounded-lg bg-muted/50 px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.descriptionLabel')}</span>
                <textarea value={newMaintenanceDescription} onChange={(event) => setNewMaintenanceDescription(event.target.value)} placeholder={t('tasks.maintenance.descriptionPlaceholder')} rows={3} className="w-full resize-none rounded-lg bg-muted/50 px-3 py-2 text-sm" />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="min-w-0 space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.priorityLabel')}</span><select value={newMaintenancePriority} onChange={(event) => setNewMaintenancePriority(event.target.value as MaintenancePriority)} className="w-full min-w-0 min-h-[var(--ctl-lg)] rounded-lg bg-muted/50 px-3 py-2 text-sm">{(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => <option key={priority} value={priority}>{t(`tasks.maintenance.priorities.${priority}`)}</option>)}</select></label>
                <label className="min-w-0 space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.assigneeLabel')}</span><select value={newMaintenanceAssignee} onChange={(event) => setNewMaintenanceAssignee(event.target.value)} className="w-full min-w-0 min-h-[var(--ctl-lg)] rounded-lg bg-muted/50 px-3 py-2 text-sm"><option value="">{t('tasks.maintenance.unassigned')}</option>{memberOptions.map((member) => <option key={member} value={member}>{member}</option>)}</select></label>
                <label className="min-w-0 space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.dueDateLabel')}</span><input type="date" value={newMaintenanceDue} onChange={(event) => setNewMaintenanceDue(event.target.value)} className="w-full min-w-0 rounded-lg bg-muted/50 px-3 py-2 text-sm" /></label>
              </div>
              <p className="text-[10px] text-muted-foreground">{t('tasks.maintenance.costLaterHint')}</p>
              <button onClick={() => void handleMaintenanceAdd()} disabled={!newMaintenanceTitle.trim()} className="w-full rounded-lg bg-ink py-2 text-sm font-semibold text-ink-foreground disabled:opacity-50">{t('tasks.maintenance.addTicket')}</button>
            </AddSheet>
          </motion.div>
        )}
      </AnimatePresence>

      {tab === 'tasks' ? (
        <>
          {swapRequests.some((request) => request.status === 'PENDING') && (
            <section className="rounded-[1.35rem] border border-primary/25 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Repeat2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">{t('tasks.swap.inboxTitle')}</h3>
              </div>
              <div className="space-y-3">
                {swapRequests
                  .filter((request) => request.status === 'PENDING')
                  .map((request) => (
                    <div key={request.id} className="rounded-xl border border-border bg-card p-3">
                      <p className="text-sm font-semibold">{request.taskTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('tasks.swap.requestedBy', { name: request.fromUser })}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => void resolveTaskSwap(request.id, 'ACCEPTED')}
                          className="rounded-full bg-ink px-3 py-2 text-xs font-bold text-ink-foreground"
                        >
                          {t('tasks.swap.accept')}
                        </button>
                        <button
                          onClick={() => void resolveTaskSwap(request.id, 'DECLINED')}
                          className="rounded-full border border-border bg-card px-3 py-2 text-xs font-bold"
                        >
                          {t('tasks.swap.decline')}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
          <div className="flex flex-wrap gap-2">
            {TASK_FILTERS.map((value) => (
              <Chip
                key={value}
                label={t(`tasks.filters.${value}`)}
                active={value === filter}
                onClick={() => setFilter(value)}
              />
            ))}
          </div>

          <AnimatePresence>
            {showAdd && !editingId && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <TaskEditor
                  title={t('tasks.newTask')}
                  newTitle={newTitle}
                  setNewTitle={setNewTitle}
                  newAssignee={newAssignee}
                  setNewAssignee={setNewAssignee}
                  members={members}
                  name={name}
                  newDue={newDue}
                  setNewDue={setNewDue}
                  newCategory={newCategory}
                  setNewCategory={setNewCategory}
                  newRecurrence={newRecurrence}
                  setNewRecurrence={setNewRecurrence}
                  newXp={newXp}
                  setNewXp={setNewXp}
                  onClose={resetForm}
                  onSave={handleSave}
                  saveLabel={t('tasks.addTask')}
                  suggestedAssignee={suggestedAssignee}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            {filteredTasks.map((task, index) => {
              const isOverdue = isOverdueTask(task);
              const isPenalized = (task.penaltyXp ?? 0) < 0;
              const taskIsPending = pendingTaskIds.has(task.id);
              const CategoryIcon = TASK_CATEGORY_ICONS[task.category] ?? CheckCircle2;

              return (
                <Fragment key={task.id}>
                  <motion.div
                    // Only replay the stagger-in on a genuine cold load — the page fully remounts on
                    // every tab switch (no route keep-alive), so an unconditional `initial` here would
                    // replay this entrance animation on every warm revisit too, reading as a flash.
                    initial={justFinishedLoading ? { opacity: 0, y: 10 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: justFinishedLoading ? index * 0.04 : 0 }}
                    className={`task !rounded-[1.35rem] !p-4 ${task.completed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        {/* The XP chip flies from the checkbox that was tapped, so the reward is
                            anchored to the thing you did rather than appearing from nowhere. */}
                        {xpBurstTaskId === task.id && (
                          <XpBurst amount={task.xp} onDone={() => setXpBurstTaskId(null)} />
                        )}
                        <motion.button
                          type="button"
                          disabled={taskIsPending}
                          aria-label={task.completed ? t('tasks.markIncomplete') : t('tasks.markComplete')}
                          {...pressable}
                          animate={task.completed ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                          transition={springPop}
                          className={`grid h-12 w-12 place-items-center rounded-2xl border-[3px] transition-colors disabled:opacity-60 ${
                            task.completed
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/70 text-transparent hover:border-primary'
                          }`}
                          onClick={() => {
                            if (taskIsPending) return;
                            void handlePrimaryToggle(task);
                          }}
                        >
                          <CheckCircle2 className="h-6 w-6" />
                        </motion.button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-base font-bold leading-snug ${task.completed ? 'line-through' : ''}`}
                        >
                          {task.title}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                            <CategoryIcon className="h-3.5 w-3.5" />
                            {translateKey('common.taskCategories', task.category)}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isOverdue
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-accent/25 text-accent-foreground'
                          }`}>
                            {formatDate(task.dueDate)}
                          </span>
                          {task.recurrenceRule && task.recurrenceRule !== 'NONE' && (
                            <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                              <RotateCcw className="h-3 w-3" />
                              {translateKey('common.recurrence', task.recurrenceRule)}
                            </span>
                          )}
                          <span className="text-sm font-bold text-destructive">+{task.xp} XP</span>
                          {isPenalized && (
                            <span className="rounded-full bg-secondary/20 px-2 py-1 text-[10px] font-medium text-secondary-foreground">
                              {t('tasks.penaltyApplied')}
                            </span>
                          )}
                          {task.assignmentReason === 'LATE' && (
                            <span className="rounded-full bg-secondary/20 px-2 py-1 text-[10px] font-medium text-secondary-foreground">
                              {translateKey(
                                'common.taskAssignmentReasons',
                                task.assignmentReason,
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-14 shrink-0 text-center">
                        <Avatar name={task.assignee} className="mx-auto h-12 w-12 text-lg" />
                        <span className="mt-1 block truncate text-[10px] font-semibold text-muted-foreground">
                          {task.assignee}
                        </span>
                      </div>
                    </div>

	                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
                      {!task.completed && isOverdue && !isPenalized && (
                        <button
                          onClick={() => {
                            void markLate(task);
                          }}
                          disabled={taskIsPending}
                          className="flex h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-[10px] font-medium text-destructive disabled:opacity-60"
                        >
                          <Clock className="h-3 w-3" />
                          {t('tasks.completeLate')}
                        </button>
                      )}
                      {!task.completed && isOverdue && isPenalized && (
                        <button
                          onClick={() => {
                            void completeMissedTask(task);
                          }}
                          disabled={taskIsPending}
                          className="flex h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-[10px] font-medium text-destructive disabled:opacity-60"
                        >
                          <Clock className="h-3 w-3" />
                          {t('tasks.regretMissed')}
                        </button>
                      )}
	                      <OverflowMenu
	                        label={t('common.actions')}
	                        actions={[
	                          {
	                            label: t('tasks.editTaskAria'),
	                            icon: <Edit3 className="h-4 w-4" />,
	                            onSelect: () => startEdit(task),
	                          },
	                          ...(task.assignee === name && !task.completed
	                            ? [{
	                              label: t('tasks.swap.request'),
	                              icon: <Repeat2 className="h-4 w-4" />,
	                              onSelect: () => {
	                                setSwappingTaskId(swappingTaskId === task.id ? null : task.id);
	                                setSwapRecipient('');
	                              },
	                            }]
	                            : []),
	                          {
	                            label: t('tasks.toggleComments'),
	                            icon: <MessageSquare className="h-4 w-4" />,
	                            onSelect: () => setCommentingId(commentingId === task.id ? null : task.id),
	                          },
	                          {
	                            label: t('tasks.deleteTaskAria'),
	                            icon: <Trash2 className="h-4 w-4" />,
	                            destructive: true,
	                            onSelect: () => {
	                              void deleteTask(task.id);
	                            },
	                          },
	                        ]}
	                      />
	                    </div>

                    {swappingTaskId === task.id && (
                      <div className="mt-3 flex gap-2 rounded-xl border border-border bg-muted/30 p-3">
                        <select
                          value={swapRecipient}
                          onChange={(event) => setSwapRecipient(event.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                        >
                          <option value="">{t('tasks.swap.chooseRoommate')}</option>
                          {memberOptions
                            .filter((member) => member !== name)
                            .map((member) => (
                              <option key={member} value={member}>{member}</option>
                            ))}
                        </select>
                        <button
                          onClick={() => void requestTaskSwap(task.id)}
                          disabled={!swapRecipient}
                          className="rounded-lg bg-ink px-3 py-2 text-xs font-bold text-ink-foreground disabled:opacity-50"
                        >
                          {t('tasks.swap.send')}
                        </button>
                      </div>
                    )}

                    <AnimatePresence>
                      {commentingId === task.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 space-y-2 overflow-hidden"
                        >
                          {task.feedbacks.length > 0 && (
                            <div className="space-y-1.5">
                              {task.feedbacks.map((feedback) => (
                                <div
                                  key={feedback.id}
                                  className="bg-muted/30 rounded-lg px-2.5 py-2 space-y-1"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-foreground">
                                      {feedback.anonymous
                                        ? t('tasks.feedbackAnonymousAuthor')
                                        : (feedback.author ??
                                          t('tasks.feedbackAnonymousAuthor'))}
                                    </span>
                                    {feedback.anonymous && (
                                      <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />
                                    )}
                                    <span className="text-[9px] text-muted-foreground ml-auto">
                                      {formatDateTime(feedback.createdAt)}
                                    </span>
                                  </div>
                                  {feedback.message && (
                                    <p className="text-[11px] text-foreground">
                                      {feedback.message}
                                    </p>
                                  )}
                                  {feedback.imageData && feedback.imageMimeType && (
                                    <img
                                      src={`data:${feedback.imageMimeType};base64,${feedback.imageData}`}
                                      alt={t('tasks.feedbackImageAlt')}
                                      className="mt-1 rounded-lg max-h-40 object-contain"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <input
                              value={commentText}
                              onChange={(event) => setCommentText(event.target.value)}
                              placeholder={t('tasks.feedbackPlaceholder')}
                              className="flex-1 bg-muted/50 rounded-lg px-2 py-1.5 text-[11px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              onKeyDown={(event) =>
                                event.key === 'Enter' && void addFeedback(task.id)
                              }
                            />
                            <button
                              onClick={() => {
                                void addFeedback(task.id);
                              }}
                              className="px-2 rounded-lg gradient-primary text-[10px] font-medium text-ink-foreground"
                            >
                              {t('common.send')}
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setFeedbackAnonymous((value) => !value)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                                feedbackAnonymous
                                  ? 'bg-primary/20 text-primary'
                                  : 'glass text-muted-foreground'
                              }`}
                            >
                              <EyeOff className="h-3 w-3" />
                              {feedbackAnonymous
                                ? t('tasks.feedbackAnonymous')
                                : t('tasks.feedbackPublic')}
                            </button>
                            <button
                              onClick={() => void pickFeedbackImage()}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                                feedbackImage
                                  ? 'bg-primary/20 text-primary'
                                  : 'glass text-muted-foreground'
                              }`}
                            >
                              <Image className="h-3 w-3" />
                              {feedbackImage
                                ? t('tasks.feedbackImageAttached')
                                : t('tasks.feedbackAddImage')}
                            </button>
                            {feedbackImage && (
                              <button
                                onClick={removeFeedbackImage}
                                className="text-[10px] text-destructive"
                              >
                                {t('tasks.feedbackRemoveImage')}
                              </button>
                            )}
                            <input
                              ref={feedbackImageRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleFeedbackImage}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <AnimatePresence>
                    {editingId === task.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-2"
                      >
                        <TaskEditor
                          title={t('tasks.editTask')}
                          newTitle={newTitle}
                          setNewTitle={setNewTitle}
                          newAssignee={newAssignee}
                          setNewAssignee={setNewAssignee}
                          members={members}
                          name={name}
                          newDue={newDue}
                          setNewDue={setNewDue}
                          newCategory={newCategory}
                          setNewCategory={setNewCategory}
                          newRecurrence={newRecurrence}
                          setNewRecurrence={setNewRecurrence}
                          newXp={newXp}
                          setNewXp={setNewXp}
                          onClose={resetForm}
                          onSave={handleSave}
                          saveLabel={t('tasks.saveChanges')}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </div>
        </>
      ) : tab === 'shopping' ? (
        <div className="space-y-3">
          <div className="househero hero-ink">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-ink-foreground/65">{t('tasks.restockTitle')}</p>
            <p className="bignum mt-3">{shoppingToBuy} <span className="text-2xl tracking-normal">{t('tasks.shopping.toBuyUnit')}</span></p>
            <p className="mt-2 text-sm text-ink-foreground/70">{t('tasks.shopping.boughtCount', { count: shoppingBought })}</p>
            <ProgressBar value={shoppingPercent} className="mt-4 bg-ink-foreground/20" fillClassName="bg-[var(--tone-leaf)]" />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['ALL', 'TO_BUY', 'BOUGHT'] as const).map((value) => (
              <Chip
                key={value}
                label={t(`tasks.shopping.filters.${value}`)}
                active={value === shoppingFilter}
                onClick={() => setShoppingFilter(value)}
              />
            ))}
          </div>

          {shopping.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('tasks.noItemsYet')}
            </p>
          ) : filteredShopping.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('tasks.shopping.noneInFilter')}
            </p>
          ) : null}

          <div className="space-y-2">
            {filteredShopping.map((item, index) => (
              <motion.div
                key={item.id}
                initial={justFinishedLoading ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: justFinishedLoading ? index * 0.04 : 0 }}
                className={`glass rounded-2xl p-4 ${item.completed ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${item.completed ? 'line-through' : ''}`}>
                      {item.item}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('tasks.addedBy', { name: item.addedBy })}
                    </p>
                  </div>
	                  <div className="flex min-w-[9.5rem] shrink-0 items-center gap-2">
	                    {item.completed ? (
	                      <button
	                        onClick={() => {
	                          void toggleShopItem(item.id);
	                        }}
	                        className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl glass px-4 text-sm font-semibold text-primary"
	                      >
	                        <ShoppingCart className="h-4 w-4" />
	                        {t('common.undo')}
                      </button>
	                    ) : (
	                      <button
	                        onClick={() => openBuyForm(item)}
	                        className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl gradient-primary px-4 text-sm font-semibold text-ink-foreground shadow-sm"
	                      >
	                        <ShoppingCart className="h-4 w-4" />
	                        {t('tasks.shopping.buy')}
	                      </button>
	                    )}
	                    <OverflowMenu
	                      label={t('common.actions')}
	                      actions={[
	                        {
	                          label: t('tasks.editShoppingItemAria'),
	                          icon: <Edit3 className="h-4 w-4" />,
	                          onSelect: () => startEditShop(item),
	                        },
	                        {
	                          label: t('tasks.deleteShoppingItemAria'),
	                          icon: <Trash2 className="h-4 w-4" />,
	                          destructive: true,
	                          onSelect: () => {
	                            void deleteShopItem(item.id);
	                          },
	                        },
	                      ]}
	                    />
	                  </div>
                </div>

                <AnimatePresence>
                  {buyingShopId === item.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-3 space-y-2"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={buyAmount}
                          onChange={(event) => setBuyAmount(event.target.value)}
                          placeholder={t('tasks.shopping.amountPlaceholder')}
                          className="bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <select
                          value={buyPaidBy}
                          onChange={(event) => setBuyPaidBy(event.target.value)}
                          className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {memberOptions.map((member) => (
                            <option key={member} value={member}>
                              {member}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="block space-y-1">
                        <span className="text-[10px] text-muted-foreground">{t('economy.categoryLabel')}</span>
                        <select
                          value={buyCategory}
                          onChange={(event) => setBuyCategory(event.target.value)}
                          className="w-full min-h-[var(--ctl-lg)] bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {EXPENSE_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {translateKey('common.expenseCategories', c)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <p className="text-[10px] text-muted-foreground">
                        {t('tasks.shopping.splitWith')}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {memberOptions.map((member) => (
                          <button
                            key={member}
                            onClick={() => toggleBuyParticipant(member)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                              buyParticipants.includes(member)
                                ? 'gradient-primary text-ink-foreground'
                                : 'glass text-muted-foreground'
                            }`}
                          >
                            {member}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={buyDate}
                          onChange={(event) => setBuyDate(event.target.value)}
                          className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          aria-label={t('tasks.shopping.purchaseDate')}
                        />
                        <input
                          type="date"
                          value={buyDeadline}
                          onChange={(event) => setBuyDeadline(event.target.value)}
                          className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          aria-label={t('economy.deadlineDateLabel')}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            void submitBought(item.id);
                          }}
                          className="flex-1 rounded-lg gradient-primary py-2 text-sm font-semibold text-ink-foreground"
                        >
                          {t('tasks.shopping.logPurchase')}
                        </button>
                        <button
                          onClick={() => setBuyingShopId(null)}
                          className="pressable-tight h-9 w-9 shrink-0 rounded-lg glass flex items-center justify-center"
                          aria-label={t('tasks.shopping.closePurchaseForm')}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {editingShopId === item.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-2"
                    >
                      <div className="flex gap-2">
                        <input
                          value={editShopText}
                          onChange={(event) => setEditShopText(event.target.value)}
                          className="flex-1 bg-muted/50 rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void saveEditShop(item.id);
                            if (event.key === 'Escape') setEditingShopId(null);
                          }}
                        />
                        <button
                          onClick={() => {
                            void saveEditShop(item.id);
                          }}
                          className="px-3 rounded-lg gradient-primary text-xs font-medium text-ink-foreground"
                        >
                          {t('tasks.saveChanges')}
                        </button>
                        <button
                          onClick={() => setEditingShopId(null)}
                          className="h-11 w-11 rounded-lg glass flex items-center justify-center"
                          aria-label={t('common.back')}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="househero hero-ink">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-ink-foreground/65">{t('tasks.maintenance.boardTitle')}</p>
            <p className="bignum mt-3">{maintenanceOpen} <span className="text-2xl tracking-normal">{t('tasks.maintenance.openUnit')}</span></p>
            <p className="mt-2 text-sm text-ink-foreground/70">{t('tasks.maintenance.heroSubtitle', { overdue: maintenanceOverdue, done: maintenanceDone })}</p>
            <ProgressBar value={maintenancePercent} className="mt-4 bg-ink-foreground/20" fillClassName="bg-[var(--tone-leaf)]" />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['ALL', 'OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const).map((status) => (
              <button key={status} onClick={() => setMaintenanceFilter(status)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${maintenanceFilter === status ? 'gradient-primary text-ink-foreground' : 'glass text-muted-foreground'}`}>
                {status === 'ALL' ? t('tasks.maintenance.all') : t(`tasks.maintenance.statuses.${status}`)}
              </button>
            ))}
          </div>

          {maintenanceTickets.filter((ticket) => maintenanceFilter === 'ALL' || ticket.status === maintenanceFilter).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('tasks.maintenance.empty')}</p>
          )}

          {maintenanceTickets
            .filter((ticket) => maintenanceFilter === 'ALL' || ticket.status === maintenanceFilter)
            .map((ticket) => (
              <div key={ticket.id} className={`rounded-[1.2rem] border bg-card p-4 ${ticket.overdue ? 'border-destructive/60' : 'border-border'}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${ticket.overdue ? 'bg-destructive/15' : 'bg-muted'}`}>
                    {ticket.overdue ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Wrench className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{ticket.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${ticket.priority === 'URGENT' ? 'bg-destructive/15 text-destructive' : ticket.priority === 'HIGH' ? 'bg-secondary/30' : 'bg-muted text-muted-foreground'}`}>{t(`tasks.maintenance.priorities.${ticket.priority}`)}</span>
                    </div>
                    {ticket.description && <p className="mt-1 text-xs text-muted-foreground">{ticket.description}</p>}
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {ticket.dueDate ? `${t('tasks.maintenance.due')} ${formatDate(ticket.dueDate)}` : t('tasks.maintenance.noDueDate')}
                      {ticket.status === 'DONE' && ticket.costEstimate != null && ticket.costEstimate > 0 ? ` · ${ticket.costEstimate} kr` : ''}
                    </p>
                    {ticket.overdue && <p className="mt-1 text-[10px] font-bold text-destructive">{t('tasks.maintenance.overdue')}</p>}
                  </div>
	                  <OverflowMenu
	                    label={t('common.actions')}
	                    actions={deletingTicketId === ticket.id
	                      ? [
	                        {
	                          label: t('common.done'),
	                          icon: <CheckCircle2 className="h-4 w-4" />,
	                          destructive: true,
	                          onSelect: () => {
	                            void deleteMaintenanceTicket(ticket.id);
	                          },
	                        },
	                        {
	                          label: t('common.cancel'),
	                          icon: <X className="h-4 w-4" />,
	                          onSelect: () => setDeletingTicketId(null),
	                        },
	                      ]
	                      : [
	                        {
	                          label: t('tasks.maintenance.edit'),
	                          icon: <Edit3 className="h-4 w-4" />,
	                          onSelect: () => startEditTicket(ticket),
	                        },
	                        {
	                          label: t('tasks.maintenance.delete'),
	                          icon: <Trash2 className="h-4 w-4" />,
	                          destructive: true,
	                          onSelect: () => setDeletingTicketId(ticket.id),
	                        },
	                      ]}
	                  />
	                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <select value={ticket.status} onChange={(event) => handleMaintenanceStatusChange(ticket, event.target.value as MaintenanceStatus)} className="rounded-lg border border-border bg-background px-2.5 py-2.5 text-xs">
                    {(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const).map((status) => <option key={status} value={status}>{t(`tasks.maintenance.statuses.${status}`)}</option>)}
                  </select>
                  <select value={ticket.assignee ?? ''} onChange={(event) => void updateMaintenanceTicket(ticket.id, { assignee: event.target.value })} className="rounded-lg border border-border bg-background px-2.5 py-2.5 text-xs">
                    <option value="">{t('tasks.maintenance.unassigned')}</option>
                    {memberOptions.map((member) => <option key={member} value={member}>{member}</option>)}
                  </select>
                  <select value={ticket.priority} onChange={(event) => void updateMaintenanceTicket(ticket.id, { priority: event.target.value as MaintenancePriority })} className="rounded-lg border border-border bg-background px-2.5 py-2.5 text-xs">
                    {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => <option key={priority} value={priority}>{t(`tasks.maintenance.priorities.${priority}`)}</option>)}
                  </select>
                </div>
                {editingTicketId === ticket.id && (
                  <div className="mt-3 space-y-2 rounded-xl border border-border bg-background/40 p-3">
                    <input value={editTicketTitle} onChange={(event) => setEditTicketTitle(event.target.value)} placeholder={t('tasks.maintenance.titlePlaceholder')} className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm" />
                    <textarea value={editTicketDescription} onChange={(event) => setEditTicketDescription(event.target.value)} placeholder={t('tasks.maintenance.descriptionPlaceholder')} rows={2} className="w-full resize-none rounded-lg bg-muted/50 px-3 py-2 text-sm" />
                    <input type="date" value={editTicketDue} onChange={(event) => setEditTicketDue(event.target.value)} className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => void saveEditTicket()} disabled={!editTicketTitle.trim()} className="flex-1 rounded-lg bg-ink py-2 text-xs font-bold text-ink-foreground disabled:opacity-50">{t('tasks.maintenance.saveEdit')}</button>
                      <button onClick={() => setEditingTicketId(null)} className="flex-1 rounded-lg glass py-2 text-xs font-medium">{t('common.cancel')}</button>
                    </div>
                  </div>
                )}
                {ticket.statusHistory.length > 1 && (
                  <p className="mt-3 text-[9px] text-muted-foreground">
                    {ticket.statusHistory.map((entry) => `${t(`tasks.maintenance.statuses.${entry.status}`)} · ${entry.changedBy}`).join(' → ')}
                  </p>
                )}
              </div>
            ))}
        </div>
      )}

      <AnimatePresence>
        {completingTicket && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setCompletingTicket(null)}
          >
            <motion.div
              initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 24 }}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-[1.5rem] bg-background p-5 space-y-3"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">{t('tasks.maintenance.completeTitle')}</h3>
                <button onClick={() => setCompletingTicket(null)} aria-label={t('common.cancel')} className="grid h-11 w-11 place-items-center rounded-full bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">{t('tasks.maintenance.completeSubtitle', { title: completingTicket.title })}</p>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.actualCostLabel')}</span>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={completeCost}
                  onChange={(event) => setCompleteCost(event.target.value)}
                  placeholder={t('tasks.maintenance.costPlaceholder')}
                  className="w-full min-h-[var(--ctl-lg)] rounded-lg bg-muted/50 px-3 py-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">{t('economy.categoryLabel')}</span>
                <select
                  value={completeCategory}
                  onChange={(event) => setCompleteCategory(event.target.value)}
                  className="w-full min-h-[var(--ctl-lg)] rounded-lg bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {translateKey('common.expenseCategories', c)}
                    </option>
                  ))}
                </select>
              </label>
              {Number(completeCost) > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t('tasks.maintenance.splitLabel')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {memberOptions.map((member) => {
                      const selected = completeSplit.includes(member);
                      return (
                        <button
                          key={member}
                          onClick={() => setCompleteSplit((prev) => selected ? prev.filter((m) => m !== member) : [...prev, member])}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selected ? 'bg-ink text-ink-foreground' : 'bg-muted/60 text-muted-foreground'}`}
                        >
                          {member}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{t('tasks.maintenance.splitHint')}</p>
                </div>
              )}
              <button
                onClick={() => void confirmCompleteTicket()}
                disabled={Number(completeCost) > 0 && completeSplit.length === 0}
                className="w-full rounded-xl bg-ink py-2.5 text-sm font-bold text-ink-foreground disabled:opacity-50"
              >
                {t('tasks.maintenance.completeConfirm')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TasksPage() {
  return <TasksMain />;
}
