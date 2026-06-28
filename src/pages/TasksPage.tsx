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
} from 'lucide-react';
import { api } from '../lib/api';
import { capturePhotoFile, nativeCameraAvailable } from '../lib/camera';
import { useUser } from '../context/UserContext';
import { connectCollectiveRealtime } from '../lib/realtime';
import { tapFeedback } from '../lib/haptics';
import { formatDate, formatDateTime, translateKey } from '../i18n/helpers';
import type { Task, ShoppingItem, TaskCategory, TaskSwapRequest, MaintenanceTicket, MaintenancePriority, MaintenanceStatus } from '../lib/types';
import { AddSheet, Eyebrow, Fab, ProgressBar } from '../components/ui-kit';

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
          className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={(event) => event.key === 'Enter' && canSave && onSave()}
          autoFocus
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">{t('tasks.assigneeLabel')}</span>
          <select value={newAssignee} onChange={(event) => setNewAssignee(event.target.value)} className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            {(members.length > 0 ? members : [name]).map((member) => <option key={member} value={member}>{member}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">{t('tasks.dueDateLabel')}</span>
          <input type="date" value={newDue} onChange={(event) => setNewDue(event.target.value)} className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">{t('tasks.categoryLabel')}</span>
          <select value={newCategory} onChange={(event) => setNewCategory(event.target.value as TaskCategory)} className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            {CATEGORIES.map((category) => <option key={category} value={category}>{translateKey('common.taskCategories', category)}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">{t('tasks.recurrenceLabel')}</span>
          <select value={newRecurrence} onChange={(event) => setNewRecurrence(event.target.value)} className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            {RECURRENCE_OPTIONS.map((recurrence) => <option key={recurrence} value={recurrence}>{translateKey('common.recurrence', recurrence)}</option>)}
          </select>
        </label>
      </div>
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
        className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saveLabel}
      </button>
    </AddSheet>
  );
}

function TasksMain() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [swapRequests, setSwapRequests] = useState<TaskSwapRequest[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<MaintenanceTicket[]>([]);
  const [members, setMembers] = useState<string[]>([]);
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
  const [newMaintenanceCost, setNewMaintenanceCost] = useState('');
  const [newMaintenanceSplit, setNewMaintenanceSplit] = useState<string[]>([]);
  const [completingTicket, setCompletingTicket] = useState<MaintenanceTicket | null>(null);
  const [completeSplit, setCompleteSplit] = useState<string[]>([]);
  const [editingTicketId, setEditingTicketId] = useState<number | null>(null);
  const [editTicketTitle, setEditTicketTitle] = useState('');
  const [editTicketDescription, setEditTicketDescription] = useState('');
  const [editTicketCost, setEditTicketCost] = useState('');
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
  const [loading, setLoading] = useState(true);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<number>>(new Set());
  const pendingTaskIdsRef = useRef<Set<number>>(new Set());
  const tasksRef = useRef<Task[]>([]);
  const fetchRequestIdRef = useRef(0);
  const taskOverridesRef = useRef<Map<number, Task>>(new Map());

  const name = currentUser?.name ?? '';
  const memberOptions = members.length > 0 ? members : [name];

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

  const fetchAll = async () => {
    if (!name) return;
    const requestId = ++fetchRequestIdRef.current;
    const [taskRes, shopRes, swapRequestRes, maintenanceRes] = await Promise.all([
      api.get<Task[]>(`/tasks?memberName=${encodeURIComponent(name)}`),
      api.get<ShoppingItem[]>(`/tasks/shopping?memberName=${encodeURIComponent(name)}`),
      api.get<TaskSwapRequest[]>(`/users/${currentUser?.id}/swap-requests`),
      api.get<MaintenanceTicket[]>('/maintenance/tickets'),
    ]);
    if (requestId !== fetchRequestIdRef.current) return;
    setTasksState(mergeFetchedTasks(taskRes));
    setShopping(shopRes);
    setSwapRequests(swapRequestRes);
    setMaintenanceTickets(maintenanceRes);
    setLoading(false);
  };

  useEffect(() => {
    if (!name) return;
    void fetchAll();
    api.get<{ name: string }[]>(`/members/collective?memberName=${encodeURIComponent(name)}`)
      .then((response) => setMembers(response.map((member) => member.name)))
      .catch(() => {});
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (event.type === 'TASK_UPDATED') {
        const payload = event.payload as
          | { updatedBy?: string; task?: Task }
          | undefined;
        if (payload?.updatedBy === name) return;
      }

      if (event.type === 'TASK_UPDATED' || event.type === 'TASK_CREATED') {
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
          'SHOPPING_UPDATED',
          'SHOPPING_ITEM_CREATED',
          'SHOPPING_ITEM_TOGGLED',
          'SHOPPING_ITEM_DELETED',
          'SHOPPING_ITEM_UPDATED',
          'SHOPPING_ITEM_BOUGHT',
          'MAINTENANCE_UPDATED',
          'MAINTENANCE_DELETED',
        ].includes(event.type)
      ) {
        void fetchAll();
      }
    });
    return disconnect;
  }, [name]);

  const handleShoppingAdd = async () => {
    if (!newShoppingName.trim()) return;
    const created = await api.post<ShoppingItem>('/tasks/shopping', {
      item: newShoppingName,
      addedBy: name,
    });
    setShopping((prev) => [...prev, created]);
    setNewShoppingName('');
    setShowShoppingAdd(false);
  };

  const handleMaintenanceAdd = async () => {
    if (!newMaintenanceTitle.trim()) return;
    const created = await api.post<MaintenanceTicket>('/maintenance/tickets', {
      title: newMaintenanceTitle,
      description: newMaintenanceDescription,
      priority: newMaintenancePriority,
      assignee: newMaintenanceAssignee || null,
      dueDate: newMaintenanceDue || null,
      costEstimate: newMaintenanceCost ? Number(newMaintenanceCost) : null,
      splitParticipants: newMaintenanceCost ? newMaintenanceSplit : [],
    });
    setMaintenanceTickets((previous) => [...previous, created]);
    setNewMaintenanceTitle('');
    setNewMaintenanceDescription('');
    setNewMaintenanceAssignee('');
    setNewMaintenanceDue('');
    setNewMaintenanceCost('');
    setNewMaintenanceSplit([]);
    setShowMaintenanceAdd(false);
  };

  // Completing a paid ticket asks who shares the cost, then files it as an economy expense.
  const handleMaintenanceStatusChange = (ticket: MaintenanceTicket, status: MaintenanceStatus) => {
    if (status === 'DONE' && ticket.status !== 'DONE' && (ticket.costEstimate ?? 0) > 0) {
      setCompleteSplit(ticket.splitParticipants.length > 0 ? ticket.splitParticipants : memberOptions);
      setCompletingTicket(ticket);
    } else {
      void updateMaintenanceTicket(ticket.id, { status });
    }
  };

  const confirmCompleteTicket = async () => {
    if (!completingTicket) return;
    await updateMaintenanceTicket(completingTicket.id, { status: 'DONE', splitParticipants: completeSplit });
    setCompletingTicket(null);
  };

  const startEditTicket = (ticket: MaintenanceTicket) => {
    setEditingTicketId(ticket.id);
    setEditTicketTitle(ticket.title);
    setEditTicketDescription(ticket.description);
    setEditTicketCost(ticket.costEstimate != null ? String(ticket.costEstimate) : '');
    setEditTicketDue(ticket.dueDate ?? '');
    setDeletingTicketId(null);
  };

  const saveEditTicket = async () => {
    if (editingTicketId == null || !editTicketTitle.trim()) return;
    await updateMaintenanceTicket(editingTicketId, {
      title: editTicketTitle,
      description: editTicketDescription,
      costEstimate: editTicketCost ? Number(editTicketCost) : null,
      dueDate: editTicketDue || null,
    });
    setEditingTicketId(null);
  };

  const deleteMaintenanceTicket = async (ticketId: number) => {
    await api.delete(`/maintenance/tickets/${ticketId}`);
    setMaintenanceTickets((tickets) => tickets.filter((ticket) => ticket.id !== ticketId));
    setDeletingTicketId(null);
  };

  const updateMaintenanceTicket = async (ticketId: number, updates: Partial<MaintenanceTicket>) => {
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
    } catch (error) {
      clearTaskOverride(task.id);
      updateTaskInPlace(task.id, task);
      console.error(error);
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

    void tapFeedback();

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
    } else {
      const created = await api.post<Task>('/tasks', body);
      setTasksState((prev) => [...prev, created]);
    }

    resetForm();
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
    if (!commentText.trim()) return;
    await api.patch(`/tasks/${taskId}/feedback?memberName=${encodeURIComponent(name)}`, {
      message: commentText,
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

  const filteredTasks = tasks
    .filter((task) => {
      const today = new Date().toISOString().split('T')[0];
      if (filter === 'DONE') {
        if (!task.completed) return false;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return task.dueDate >= sevenDaysAgo.toISOString().split('T')[0];
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
    return (
      <div className="space-y-3 pt-4 animate-pulse">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="glass rounded-xl h-14" />
        ))}
      </div>
    );
  }

  const completedCount = tasks.filter((task) => task.completed).length;
  const completionPercent = tasks.length === 0 ? 0 : (completedCount / tasks.length) * 100;

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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pt-4"
    >
      <div>
        <Eyebrow>{t('tasks.eyebrow')}</Eyebrow>
        <h2 className="mt-2 font-display text-[2.25rem] leading-none font-extrabold tracking-[-.04em]">{t('tasks.heading')}</h2>
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
                  ? 'bg-primary text-primary-foreground shadow-sm'
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
        <div className="househero">
          <p className="text-xs font-bold uppercase tracking-[.15em] text-white/65">{t('tasks.progressLabel')}</p>
          <p className="bignum mt-3">{completedCount}<span className="text-secondary">/{tasks.length}</span> <span className="text-2xl tracking-normal">{t('tasks.done')}</span></p>
          <p className="mt-2 text-sm text-white/70">{t('tasks.remaining', { count: Math.max(0, tasks.length - completedCount) })}</p>
          <ProgressBar value={completionPercent} className="mt-4 bg-white/20" />
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
                className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
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
                <input value={newMaintenanceTitle} onChange={(event) => setNewMaintenanceTitle(event.target.value)} placeholder={t('tasks.maintenance.titlePlaceholder')} autoFocus className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.descriptionLabel')}</span>
                <textarea value={newMaintenanceDescription} onChange={(event) => setNewMaintenanceDescription(event.target.value)} placeholder={t('tasks.maintenance.descriptionPlaceholder')} rows={3} className="w-full resize-none rounded-lg bg-muted/50 px-3 py-2 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.priorityLabel')}</span><select value={newMaintenancePriority} onChange={(event) => setNewMaintenancePriority(event.target.value as MaintenancePriority)} className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm">{(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => <option key={priority} value={priority}>{t(`tasks.maintenance.priorities.${priority}`)}</option>)}</select></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.assigneeLabel')}</span><select value={newMaintenanceAssignee} onChange={(event) => setNewMaintenanceAssignee(event.target.value)} className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm"><option value="">{t('tasks.maintenance.unassigned')}</option>{memberOptions.map((member) => <option key={member} value={member}>{member}</option>)}</select></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.dueDateLabel')}</span><input type="date" value={newMaintenanceDue} onChange={(event) => setNewMaintenanceDue(event.target.value)} className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('tasks.maintenance.costLabel')}</span><input type="number" min="0" value={newMaintenanceCost} onChange={(event) => setNewMaintenanceCost(event.target.value)} placeholder={t('tasks.maintenance.costPlaceholder')} className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm" /></label>
              </div>
              {Number(newMaintenanceCost) > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{t('tasks.maintenance.splitLabel')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {memberOptions.map((member) => {
                      const selected = newMaintenanceSplit.includes(member);
                      return (
                        <button
                          key={member}
                          onClick={() => setNewMaintenanceSplit((prev) => selected ? prev.filter((m) => m !== member) : [...prev, member])}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'}`}
                        >
                          {member}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{t('tasks.maintenance.splitHint')}</p>
                </div>
              )}
              <button onClick={() => void handleMaintenanceAdd()} disabled={!newMaintenanceTitle.trim()} className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t('tasks.maintenance.addTicket')}</button>
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
                          className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
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
          <div className="flex gap-2 flex-wrap">
            {TASK_FILTERS.map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  value === filter
                    ? 'gradient-primary text-primary-foreground'
                    : 'glass text-muted-foreground'
                }`}
              >
                {t(`tasks.filters.${value}`)}
              </button>
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
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            {filteredTasks.map((task, index) => {
              const isOverdue = isOverdueTask(task);
              const isPenalized = (task.penaltyXp ?? 0) < 0;
              const taskIsPending = pendingTaskIds.has(task.id);

              return (
                <Fragment key={task.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={`task !rounded-[1.35rem] !p-4 ${task.completed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        disabled={taskIsPending}
                        aria-label={task.completed ? t('tasks.markIncomplete') : t('tasks.markComplete')}
                        className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-[3px] transition-colors disabled:opacity-60 ${
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
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-base font-bold leading-snug ${task.completed ? 'line-through' : ''}`}
                        >
                          {task.title}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
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
                        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                          {task.assignee[0]?.toUpperCase()}
                        </span>
                        <span className="mt-1 block truncate text-[10px] font-semibold text-muted-foreground">
                          {task.assignee}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2 border-t border-border pt-3">
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
                      <button
                        onClick={() => startEdit(task)}
                        className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
                        aria-label={t('tasks.editTaskAria')}
                      >
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {task.assignee === name && !task.completed && (
                        <button
                          onClick={() => {
                            setSwappingTaskId(swappingTaskId === task.id ? null : task.id);
                            setSwapRecipient('');
                          }}
                          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
                          aria-label={t('tasks.swap.request')}
                        >
                          <Repeat2 className="h-4 w-4 text-primary" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          void deleteTask(task.id);
                        }}
                        className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"
                        aria-label={t('tasks.deleteTaskAria')}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                      <button
                        onClick={() =>
                          setCommentingId(commentingId === task.id ? null : task.id)
                        }
                        className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-muted-foreground"
                        aria-label={t('tasks.toggleComments')}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
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
                          className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
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
                                    <span className="text-[10px] font-semibold text-primary">
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
                                  <p className="text-[11px] text-foreground">
                                    {feedback.message}
                                  </p>
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
                              className="px-2 rounded-lg gradient-primary text-[10px] font-medium text-primary-foreground"
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
          <div className="househero">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-white/65">{t('tasks.restockTitle')}</p>
            <p className="bignum mt-3">{shoppingToBuy} <span className="text-2xl tracking-normal">{t('tasks.shopping.toBuyUnit')}</span></p>
            <p className="mt-2 text-sm text-white/70">{t('tasks.shopping.boughtCount', { count: shoppingBought })}</p>
            <ProgressBar value={shoppingPercent} className="mt-4 bg-white/20" />
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['ALL', 'TO_BUY', 'BOUGHT'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setShoppingFilter(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  value === shoppingFilter
                    ? 'gradient-primary text-primary-foreground'
                    : 'glass text-muted-foreground'
                }`}
              >
                {t(`tasks.shopping.filters.${value}`)}
              </button>
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
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.completed ? (
                      <button
                        onClick={() => {
                          void toggleShopItem(item.id);
                        }}
                        className="h-10 px-4 rounded-lg glass text-sm font-semibold flex items-center gap-1.5 text-primary"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {t('common.undo')}
                      </button>
                    ) : (
                      <button
                        onClick={() => openBuyForm(item)}
                        className="h-10 px-4 rounded-lg gradient-primary text-sm font-semibold flex items-center gap-1.5 text-primary-foreground shadow-sm"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {t('tasks.shopping.buy')}
                      </button>
                    )}
                    <button
                      onClick={() => startEditShop(item)}
                      className="h-10 w-10 rounded-lg glass flex items-center justify-center shrink-0"
                      aria-label={t('tasks.editShoppingItemAria')}
                    >
                      <Edit3 className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        void deleteShopItem(item.id);
                      }}
                      className="h-10 w-10 rounded-lg glass flex items-center justify-center shrink-0"
                      aria-label={t('tasks.deleteShoppingItemAria')}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
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
                                ? 'gradient-primary text-primary-foreground'
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
                          className="flex-1 rounded-lg gradient-primary py-2 text-sm font-semibold text-primary-foreground"
                        >
                          {t('tasks.shopping.logPurchase')}
                        </button>
                        <button
                          onClick={() => setBuyingShopId(null)}
                          className="h-9 w-9 shrink-0 rounded-lg glass flex items-center justify-center"
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
                          className="px-3 rounded-lg gradient-primary text-xs font-medium text-primary-foreground"
                        >
                          {t('tasks.saveChanges')}
                        </button>
                        <button
                          onClick={() => setEditingShopId(null)}
                          className="h-8 w-8 rounded-lg glass flex items-center justify-center"
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
          <div className="househero">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-white/65">{t('tasks.maintenance.boardTitle')}</p>
            <p className="bignum mt-3">{maintenanceOpen} <span className="text-2xl tracking-normal">{t('tasks.maintenance.openUnit')}</span></p>
            <p className="mt-2 text-sm text-white/70">{t('tasks.maintenance.heroSubtitle', { overdue: maintenanceOverdue, done: maintenanceDone })}</p>
            <ProgressBar value={maintenancePercent} className="mt-4 bg-white/20" />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['ALL', 'OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const).map((status) => (
              <button key={status} onClick={() => setMaintenanceFilter(status)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${maintenanceFilter === status ? 'gradient-primary text-primary-foreground' : 'glass text-muted-foreground'}`}>
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
                      {ticket.costEstimate != null ? ` · ${ticket.costEstimate} kr` : ''}
                    </p>
                    {ticket.overdue && <p className="mt-1 text-[10px] font-bold text-destructive">{t('tasks.maintenance.overdue')}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => startEditTicket(ticket)} aria-label={t('tasks.maintenance.edit')} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    {deletingTicketId === ticket.id ? (
                      <>
                        <button onClick={() => void deleteMaintenanceTicket(ticket.id)} aria-label={t('common.done')} className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeletingTicketId(null)} aria-label={t('common.cancel')} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setDeletingTicketId(ticket.id)} aria-label={t('tasks.maintenance.delete')} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
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
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={editTicketDue} onChange={(event) => setEditTicketDue(event.target.value)} className="rounded-lg bg-muted/50 px-3 py-2 text-sm" />
                      <input type="number" min="0" value={editTicketCost} onChange={(event) => setEditTicketCost(event.target.value)} placeholder={t('tasks.maintenance.costPlaceholder')} className="rounded-lg bg-muted/50 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void saveEditTicket()} disabled={!editTicketTitle.trim()} className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{t('tasks.maintenance.saveEdit')}</button>
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
                <button onClick={() => setCompletingTicket(null)} className="grid h-8 w-8 place-items-center rounded-full bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">{t('tasks.maintenance.completeSubtitle', { title: completingTicket.title, amount: `${completingTicket.costEstimate} kr` })}</p>
              <div className="flex flex-wrap gap-1.5">
                {memberOptions.map((member) => {
                  const selected = completeSplit.includes(member);
                  return (
                    <button
                      key={member}
                      onClick={() => setCompleteSplit((prev) => selected ? prev.filter((m) => m !== member) : [...prev, member])}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'}`}
                    >
                      {member}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => void confirmCompleteTicket()}
                disabled={completeSplit.length === 0}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
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
