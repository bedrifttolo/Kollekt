import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, Check, Recycle, ChevronRight, ChevronLeft, X, Users, Pencil, Trash2, Copy, ExternalLink, CircleCheckBig, Wallet, PiggyBank } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { qk } from '../lib/queryKeys';
import { queryClient as sharedQueryClient } from '../lib/queryClient';
import { useUser, useRealtimeEvent } from '../context/UserContext';
import { formatCurrency, formatDate, translateKey } from '../i18n/helpers';
import type { AppUser, Budget, EconomySummary, Expense, PaymentHandles, PayOption } from '../lib/types';
import { Avatar, CountUp, EmptyState, Eyebrow, Fab, IconButton, OverflowMenu, ProgressRing, Sheet } from '../components/ui-kit';
import { PAGE_ACCENTS } from '../lib/pageAccent';
import { listContainer, listItem, pressableSubtle, useReducedMotion } from '../lib/motion';
import { celebrate } from '../lib/celebrate';
import { colorForMember } from '../lib/memberColors';
import {
  availableMethods,
  clipboardPayload,
  hasAnyMethod,
  needsManualEntry,
  openPaymentLink,
  type PaymentMethod,
} from '../lib/paymentLinks';
import { onAppResume } from '../lib/appLifecycle';
import BudgetBars from '../components/charts/BudgetBars';
import CategoryBars from '../components/charts/CategoryBars';
import CategoryDonut from '../components/charts/CategoryDonut';
import MonthStrip from '../components/charts/MonthStrip';
import {
  breakdownForMonth,
  latestMonthKey,
  monthlyTotals,
  parseMonthKey,
  shiftMonthKey,
  EXPENSE_CATEGORIES as CANONICAL_CATEGORIES,
  type ExpenseCategory,
} from '../lib/expenseStats';
import { formatMonthYear } from '../i18n/helpers';

const PROVIDER_LABELS: Record<string, string> = {
  vipps: 'Vipps',
  mobilepay: 'MobilePay',
  paypal: 'PayPal',
  bank: 'economy.pay.bankTransfer',
  card: 'economy.pay.cardInfo',
};

// Single source of truth, shared with the stats layer and matched by the V60 CHECK constraint.
const EXPENSE_CATEGORIES: readonly string[] = CANONICAL_CATEGORIES;

export default function EconomyPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useUser();
  // Seed from the React Query cache so re-entering the tab renders instantly from the
  // warm cache instead of flashing the loading skeleton on every navigation.
  const [summary, setSummary] = useState<EconomySummary | null>(
    () => sharedQueryClient.getQueryData<EconomySummary>(qk.economy(currentUser?.name ?? '')) ?? null,
  );
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('Other');
  const [newSplit, setNewSplit] = useState<string[]>([]);
  const [loading, setLoading] = useState(
    () => !sharedQueryClient.getQueryData(qk.economy(currentUser?.name ?? '')),
  );
  const wasLoadingRef = useRef(loading);
  const reducedMotion = useReducedMotion();
  const [settling, setSettling] = useState(false);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  // null until the summary lands, then defaults to the newest month that actually has expenses —
  // a household that logs sporadically shouldn't open on an empty "this month".
  const [statsMonth, setStatsMonth] = useState<string | null>(null);
  // Shared by the donut and its legend so highlighting in one highlights in the other. null = the
  // whole month, which is what the ring's centre reports by default.
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);
  const [newDeadline, setNewDeadline] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('Other');
  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(null);
  const [payOptions, setPayOptions] = useState<PayOption[]>(
    () => sharedQueryClient.getQueryData<EconomySummary>(qk.economy(currentUser?.name ?? ''))?.payOptions ?? [],
  );
  const [selectedCreditorName, setSelectedCreditorName] = useState('');
  const [showPaySheet, setShowPaySheet] = useState(false);
  // Per-person breakdown behind the headline balance: a single net number hides whether you owe
  // one housemate a lot or three of them a little.
  const [showBalanceSheet, setShowBalanceSheet] = useState(false);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [payOpenFailed, setPayOpenFailed] = useState<string | null>(null);
  // True from the moment we hand off to a payment app until the user answers the confirmation
  // prompt on their way back. Replaces the old acknowledge-checkbox + separate-button pair.
  const [awaitingReturn, setAwaitingReturn] = useState(false);

  const name = currentUser?.name ?? '';

  // Whether *you* can be paid. The only related message today (economy.pay.noMethods) is shown to
  // the debtor about the creditor — i.e. to the one person who cannot fix it.
  const { data: myHandles } = useQuery({
    queryKey: qk.profilePayments(name),
    enabled: !!name,
    queryFn: () => api.get<PaymentHandles>(`/members/payment-handles?memberName=${encodeURIComponent(name)}`),
  });

  const { data: collectiveMembers = [] } = useQuery({
    queryKey: qk.members(name),
    enabled: !!name,
    queryFn: () => api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(name)}`),
  });
  const members = collectiveMembers.map((member) => member.name);

  // Seed the even split once the roster first loads. Guarded so a later refetch can't wipe
  // a split the user is in the middle of editing.
  const splitSeeded = useRef(false);
  useEffect(() => {
    if (splitSeeded.current || collectiveMembers.length === 0) return;
    splitSeeded.current = true;
    setNewSplit(collectiveMembers.map((member) => member.name));
  }, [collectiveMembers]);

  const parsedNewAmount = Number(newAmount);
  const canAddExpense = newTitle.trim().length > 0 && Number.isFinite(parsedNewAmount) && parsedNewAmount >= 1 && (members.length === 0 || newSplit.length > 0);

  const queryClient = useQueryClient();

  // One screen-specific request returns expenses, balances, pant and payment options.
  const { data: economyBundle } = useQuery({
    queryKey: qk.economy(name),
    enabled: !!name,
    queryFn: () => api.get<EconomySummary>(`/economy/summary?memberName=${encodeURIComponent(name)}`),
  });

  useEffect(() => {
    if (!economyBundle) return;
    const res = economyBundle;
    setSummary(res);
    setPayOptions(res.payOptions);
    setSelectedCreditorName((prev) => {
      if (res.payOptions.length === 0) return '';
      return res.payOptions.some((option) => option.name === prev) ? prev : res.payOptions[0].name;
    });
    setLoading(false);
  }, [economyBundle]);

  const fetchSummary = async () => {
    if (!name) return;
    void queryClient.invalidateQueries({ queryKey: qk.dashboard(name) });
    await queryClient.invalidateQueries({ queryKey: qk.economy(name) });
  };

  // Budgets are their own endpoint (see EconomyOperations.getBudgets) rather than a field on
  // /economy/summary — the cap rarely changes and shouldn't force a heavier response on every
  // expense fetch.
  const { data: budgets = [], isPending: budgetsPending } = useQuery({
    queryKey: qk.budgets(name),
    enabled: !!name,
    queryFn: () => api.get<Budget[]>(`/economy/budgets?memberName=${encodeURIComponent(name)}`),
  });

  const handleSaveBudget = async (category: ExpenseCategory, monthlyLimit: number) => {
    await api.put<Budget>('/economy/budgets', { memberName: name, category, monthlyLimit });
    await queryClient.invalidateQueries({ queryKey: qk.budgets(name) });
  };

  useRealtimeEvent(
    (event) => {
      if (['EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED', 'BALANCES_SETTLED', 'PANT_ADDED', 'PANT_UPDATED', 'PANT_DELETED'].includes(event.type)) {
        fetchSummary();
      }
      if (event.type === 'BUDGET_UPDATED' && name) {
        void queryClient.invalidateQueries({ queryKey: qk.budgets(name) });
      }
      if (event.type === 'MEMBER_RENAMED') {
        void queryClient.invalidateQueries({ queryKey: qk.members(name) });
        fetchSummary();
      }
    },
    () => fetchSummary(),
  );

  // Coming back into the app after a hand-off is the moment to ask whether the payment happened.
  // Without this the user has to remember to reopen Kollekt and find the button.
  useEffect(() => {
    if (!awaitingReturn) return;
    return onAppResume(() => setShowPaySheet(true));
  }, [awaitingReturn]);

  const toggleSplit = (member: string) =>
    setNewSplit((prev) => prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]);

  const handleAddExpense = async () => {
    if (!canAddExpense) return;
    const body = {
      description: newTitle.trim(),
      amount: Math.round(parsedNewAmount),
      paidBy: name,
      category: newCategory,
      date: new Date().toISOString().split('T')[0],
      participantNames: newSplit.length > 0 ? newSplit : [name],
      ...(newDeadline ? { deadlineDate: newDeadline } : {}),
    };
    const draft = { newTitle, newAmount, newCategory, newSplit, newDeadline };
    // Optimistic: show the expense row and close the form at once. Balances stay server-owned
    // and refresh when fetchSummary lands; the temp row is normalised away by the refetch.
    const tempId = -Date.now();
    const optimistic: Expense = { id: tempId, ...body };
    setSummary((prev) => (prev ? { ...prev, expenses: [optimistic, ...prev.expenses] } : prev));
    setNewTitle(''); setNewAmount(''); setNewCategory('Other'); setNewSplit(members); setNewDeadline('');
    setShowAdd(false);
    try {
      await api.post<Expense>('/economy/expenses', body);
      fetchSummary();
    } catch {
      setSummary((prev) => (prev ? { ...prev, expenses: prev.expenses.filter((e) => e.id !== tempId) } : prev));
      setNewTitle(draft.newTitle); setNewAmount(draft.newAmount); setNewCategory(draft.newCategory);
      setNewSplit(draft.newSplit); setNewDeadline(draft.newDeadline);
      setShowAdd(true);
    }
  };

  const startEdit = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setEditTitle(expense.description);
    setEditAmount(String(expense.amount));
    setEditCategory(expense.category);
    setDeletingExpenseId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingExpenseId || !editTitle.trim() || !editAmount) return;
    await api.patch(`/economy/expenses/${editingExpenseId}`, {
      description: editTitle,
      amount: Math.round(parseFloat(editAmount)),
      category: editCategory,
    });
    setEditingExpenseId(null);
    fetchSummary();
  };

  const handleDeleteExpense = async (id: number) => {
    await api.delete(`/economy/expenses/${id}`);
    setDeletingExpenseId(null);
    fetchSummary();
  };

  const handleMarkSettled = async () => {
    if (!selectedPayOption) return;
    setSettling(true);
    try {
      await api.post('/economy/settle-with', { creditorName: selectedPayOption.name });
      setShowPaySheet(false);
      setAwaitingReturn(false);
      // Clearing a debt is the moment the whole economy feature exists for, and it is rare enough
      // that a full burst never wears out. Fired after the sheet closes so the confetti is not
      // painted behind it.
      celebrate('settled');
      fetchSummary();
    } catch {}
    setSettling(false);
  };

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue((v) => (v === value ? null : v)), 1500);
    } catch {}
  };

  /**
   * Hands off to the payment app, putting the recipient on the clipboard first — Vipps and
   * MobilePay open cold with nothing pre-filled, so the recipient has to be typed/pasted into
   * their Send flow's recipient search; the amount is already visible on screen instead.
   */
  const handoffTo = async (method: PaymentMethod) => {
    setPayOpenFailed(null);
    if (needsManualEntry(method)) await copyValue(clipboardPayload(method));
    if (!method.url) return true;
    const opened = await openPaymentLink(method.url).catch(() => false);
    if (!opened) {
      // App not installed. The handle is already copied, so the user can still pay another way.
      setPayOpenFailed(method.provider);
      if (!needsManualEntry(method)) await copyValue(method.value);
    }
    return opened;
  };

  /**
   * The primary CTA. When the creditor registered exactly one payment method there is nothing to
   * choose, so the sheet is skipped entirely and we go straight to their app — the flow the user
   * actually wants is two taps: this one, then confirming on the way back.
   */
  const handlePayCreditor = async () => {
    if (!selectedPayOption) return;
    setPayOpenFailed(null);
    const methods = availableMethods(selectedPayOption.handles, selectedPayOption.amount);
    if (methods.length !== 1) {
      setShowPaySheet(true);
      return;
    }
    const opened = await handoffTo(methods[0]);
    // Only arm the confirmation once we actually left the app; otherwise the user never went
    // anywhere and would be asked whether they paid out of nowhere.
    if (opened) setAwaitingReturn(true);
    else setShowPaySheet(true);
  };

  const handleOpenPayment = async (method: PaymentMethod) => {
    const opened = await handoffTo(method);
    if (opened) setAwaitingReturn(true);
  };

  // Everything the stats section needs is derived from summary.expenses, which /economy/summary
  // already returns in full — no extra request. Memoised so realtime refetches of unrelated parts
  // of the summary don't re-aggregate the whole history on every render.
  // Declared above the early return so the hook order stays stable while loading.
  const expenses = summary?.expenses;
  const activeMonth = statsMonth ?? latestMonthKey(expenses ?? []);
  const stats = useMemo(() => {
    if (!expenses) return null;
    return {
      breakdown: breakdownForMonth(expenses, activeMonth, name),
      months: monthlyTotals(expenses, activeMonth, 6, name),
    };
  }, [expenses, activeMonth, name]);

  if (loading || !summary || !stats || budgetsPending) {
    wasLoadingRef.current = true;
    return <div className="space-y-4 pt-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="skeleton rounded-2xl h-20" />)}</div>;
  }
  // Tracks whether this render followed a real loading state, so the per-item entrance
  // animations below only replay right after a genuine cold load — a warm revisit (loading
  // never true) renders instantly instead of restaging the stagger-in on every tab switch.
  const justFinishedLoading = wasLoadingRef.current && !reducedMotion;
  wasLoadingRef.current = false;

  // Guarded against a zero goal, which the API allows and which would otherwise divide to Infinity.
  const pantPercent = summary.pantSummary && summary.pantSummary.goalAmount > 0
    ? Math.min(100, (summary.pantSummary.currentAmount / summary.pantSummary.goalAmount) * 100)
    : 0;
  const spentByCategory = Object.fromEntries(stats.breakdown.categories.map((c) => [c.category, c.total]));
  const fallbackCreditor = summary.balances.find((b) => b.amount > 0 && b.name !== name);
  const selectedPayOption = payOptions.find((option) => option.name === selectedCreditorName) ?? payOptions[0];
  const hasPayOptions = payOptions.length > 0;
  // `owedToYou` is the creditor-side mirror the backend computes from the same pairwise model as
  // `payOptions`. Older backends omit it entirely, which is what `pairwiseKnown` distinguishes —
  // an empty list means "nobody owes you", `undefined` means "this backend can't say".
  const owedToYou = summary.owedToYou ?? [];
  const pairwiseKnown = summary.owedToYou !== undefined;
  const totalYouOwe = payOptions.reduce((sum, option) => sum + option.amount, 0);
  const totalOwedToYou = owedToYou.reduce((sum, entry) => sum + entry.amount, 0);

  /**
   * One model for the whole screen: the pairwise one, which is what settle-up actually acts on.
   *
   * `summary.balances` is the other model — each member's net standing across the whole household.
   * The two disagree whenever a pair has overpaid, because the pairwise side floors each pair at
   * zero (see netBilateralOwed) while the household net lets the excess carry. That let the card
   * read "+5 kr" while the breakdown under it listed 86 kr of debts, which is the kind of
   * disagreement that makes people stop trusting the number. Everything below — headline, per-
   * person grid, breakdown sheet — is now derived from the pairwise lists, and falls back to the
   * household nets only against a backend too old to send `owedToYou`.
   */
  const myBalance = summary.balances.find((b) => b.name === name);
  const netBalance = pairwiseKnown ? totalOwedToYou - totalYouOwe : (myBalance?.amount ?? 0);
  const oweAmount = netBalance < 0 ? Math.abs(netBalance) : 0;
  const getAmount = netBalance > 0 ? netBalance : 0;

  /**
   * Your standing with each housemate, same pairwise numbers the breakdown sheet lists. The roster
   * is the union of all three lists rather than `balances` alone, so anyone who appears only as a
   * debtor or only as a creditor still gets a tile instead of being silently dropped.
   */
  const standings = pairwiseKnown
    ? [...new Set([
        ...summary.balances.map((b) => b.name),
        ...payOptions.map((o) => o.name),
        ...owedToYou.map((e) => e.name),
      ])]
        .filter((member) => member !== name)
        .map((member) => ({
          name: member,
          amount: (owedToYou.find((e) => e.name === member)?.amount ?? 0)
            - (payOptions.find((o) => o.name === member)?.amount ?? 0),
        }))
        .sort((a, b) => b.amount - a.amount)
    : summary.balances;

  return (
    <motion.div initial={false} animate={{ opacity: 1 }} className="space-y-4 pt-3">
      <div>
        <Eyebrow accent={PAGE_ACCENTS['/economy']}>{t('economy.eyebrow')}</Eyebrow>
        <h2 className="mt-2 display-md">{t('economy.titleLineOne')} <span className="mark">{t('economy.titleLineTwo')}</span></h2>
      </div>

      {/* Balance card */}
      <div className="wallet hero-ink">
        {/* The headline half of the card is the breakdown's entry point. Only this region is the
            button — the creditor picker and pay button below are their own controls and must not
            end up nested inside it. */}
        <button
          type="button"
          onClick={() => setShowBalanceSheet(true)}
          className="block w-full text-left"
          aria-label={t('economy.breakdown.open')}
        >
          <p className="text-xs font-bold uppercase tracking-[.16em] text-ink-foreground/65 mb-1">{t('economy.yourBalance')}</p>
          {/* Amount colours come from the hero palette, not the page palette: `text-foreground` and
              `text-primary` are both the hero's own colour in the light theme, which made a settled
              balance disappear into the card. A zero balance just inherits the hero foreground. */}
          <p className={`font-display text-4xl font-extrabold tracking-tight ${oweAmount > 0 ? 'hero-amount-negative' : getAmount > 0 ? 'hero-amount-positive' : ''}`}>
            {oweAmount > 0 && '- '}
            {getAmount > 0 && '+ '}
            <CountUp value={oweAmount > 0 ? oweAmount : getAmount} format={formatCurrency} />
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-foreground/70">
            {hasPayOptions && selectedPayOption ? t('economy.owe', { name: selectedPayOption.name, amount: formatCurrency(selectedPayOption.amount) })
            : oweAmount > 0 && fallbackCreditor ? t('economy.owe', { name: fallbackCreditor.name, amount: formatCurrency(oweAmount) })
            : getAmount > 0 ? t('economy.othersOweYou')
            : <>
                <CircleCheckBig className="h-3.5 w-3.5 shrink-0" />
                {t('economy.allSettled')}
              </>}
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </p>
        </button>
        {hasPayOptions && selectedPayOption && (
          <div className="mt-4 space-y-2.5">
            {payOptions.length > 1 && (
              <select
                value={selectedPayOption.name}
                onChange={(e) => setSelectedCreditorName(e.target.value)}
                className="input border-ink-foreground/20 bg-ink-foreground/10 font-medium focus:ring-1 focus:ring-secondary"
                aria-label={t('economy.payPersonLabel')}
              >
                {payOptions.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name} ({formatCurrency(option.amount)})
                  </option>
                ))}
              </select>
            )}
            <div>
              <button onClick={() => void handlePayCreditor()} disabled={settling || !selectedPayOption}
                className="btn-lemon w-full disabled:opacity-60">
                <Check className="h-4 w-4" /> {t('economy.payAmountTo', { name: selectedPayOption.name, amount: formatCurrency(selectedPayOption.amount) })}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Balance breakdown — who the headline number is actually made of, per housemate */}
      <Sheet
        open={showBalanceSheet}
        onClose={() => setShowBalanceSheet(false)}
        size="md"
        title={
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('economy.breakdown.title')}</p>
            <p className="text-xs text-muted-foreground">{t('economy.breakdown.subtitle')}</p>
          </div>
        }
      >
        <div className="space-y-4">
          {payOptions.length === 0 && owedToYou.length === 0 && (
            <EmptyState
              tone="mint"
              icon={<CircleCheckBig className="h-6 w-6" />}
              title={t('economy.breakdown.settledTitle')}
              body={t('economy.breakdown.settledBody')}
            />
          )}

          {payOptions.length > 0 && (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">{t('economy.breakdown.youOwe')}</h4>
                <span className="text-xs font-semibold text-destructive">{formatCurrency(totalYouOwe)}</span>
              </div>
              <div className="space-y-2">
                {payOptions.map((option) => (
                  <button
                    key={option.name}
                    type="button"
                    // Straight into the existing pay flow for that person, so the breakdown is a
                    // way to act and not just a read-out.
                    onClick={() => {
                      setSelectedCreditorName(option.name);
                      setShowBalanceSheet(false);
                      setShowPaySheet(true);
                    }}
                    className="tone-blush tone-wash tone-edge elev-1 flex w-full items-center gap-3 rounded-xl border p-3 text-left"
                  >
                    <Avatar name={option.name} className="h-9 w-9 text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{option.name}</p>
                      <p className="text-[11px] text-muted-foreground">{t('economy.breakdown.tapToSettle')}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-destructive">- {formatCurrency(option.amount)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {owedToYou.length > 0 && (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">{t('economy.breakdown.owesYou')}</h4>
                <span className="text-xs font-semibold text-primary">{formatCurrency(totalOwedToYou)}</span>
              </div>
              <div className="space-y-2">
                {owedToYou.map((entry) => (
                  <div
                    key={entry.name}
                    className="tone-mint tone-wash tone-edge elev-1 flex items-center gap-3 rounded-xl border p-3"
                  >
                    <Avatar name={entry.name} className="h-9 w-9 text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.name}</p>
                      <p className="text-[11px] text-muted-foreground">{t('economy.breakdown.theirMove')}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-primary">+ {formatCurrency(entry.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(payOptions.length > 0 || owedToYou.length > 0) && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">{t('economy.breakdown.note')}</p>
          )}
        </div>
      </Sheet>

      {/* Pay sheet — deep-links to the creditor's payment apps; Kollekt never moves money */}
      <Sheet
        open={showPaySheet && Boolean(selectedPayOption)}
        onClose={() => setShowPaySheet(false)}
        size="md"
        title={
          selectedPayOption ? (
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {awaitingReturn
                  ? t('economy.pay.didYouPay', { name: selectedPayOption.name })
                  : t('economy.pay.title', { name: selectedPayOption.name })}
              </p>
              <p className="text-xs text-muted-foreground">{t('economy.pay.subtitle', { amount: formatCurrency(selectedPayOption.amount) })}</p>
            </div>
          ) : undefined
        }
      >
        {selectedPayOption && (
          <div className="space-y-3">

              {!awaitingReturn && (<div className="space-y-2">
                {!hasAnyMethod(selectedPayOption.handles) && (
                  <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                    {t('economy.pay.noMethods')}
                  </p>
                )}
                {availableMethods(selectedPayOption.handles, selectedPayOption.amount).map((m) => {
                  const label = PROVIDER_LABELS[m.provider];
                  const display = label.includes('.') ? t(label) : label;
                  return (
                    <div key={m.provider} className="glass rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{display}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.value}</p>
                        </div>
                        <button
                          onClick={() => void copyValue(m.value)}
                          className="pressable-tight h-9 w-9 rounded-lg glass flex items-center justify-center shrink-0"
                          aria-label={t('economy.pay.copy')}
                        >
                          {copiedValue === m.value ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        {m.url && (
                          <button
                            onClick={() => void handleOpenPayment(m)}
                            // A real 44px target rather than .btn-sm's grown one: its neighbour is
                            // already a .pressable-tight 36px button, and two grown hit areas 12px
                            // apart would overlap over the gap between them.
                            className="rounded-lg gradient-primary px-3 min-h-11 text-xs font-semibold text-ink-foreground flex items-center gap-1.5 shrink-0"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> {t('economy.pay.open')}
                          </button>
                        )}
                      </div>
                      {payOpenFailed === m.provider && (
                        <p className="text-xs text-muted-foreground">{t('economy.pay.appNotInstalled')}</p>
                      )}
                    </div>
                  );
                })}
              </div>)}

              {!awaitingReturn && <p className="text-[11px] text-muted-foreground">{t('economy.pay.disclaimer')}</p>}

              <button
                onClick={() => void handleMarkSettled()}
                disabled={settling}
                className="w-full gradient-primary rounded-xl py-2.5 text-sm font-semibold text-ink-foreground flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Check className="h-4 w-4" /> {t('economy.pay.markSettled')}
              </button>

              {awaitingReturn && (
                <button
                  onClick={() => { setShowPaySheet(false); setAwaitingReturn(false); }}
                  className="w-full rounded-xl py-2 text-sm font-semibold text-muted-foreground"
                >
                  {t('economy.pay.notYet')}
                </button>
              )}
          </div>
        )}
      </Sheet>

      {!showAdd && <Fab onClick={() => setShowAdd(true)} label={t('economy.newExpense')} />}

      {/* Add expense form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t('economy.newExpense')}</p>
                <IconButton onClick={() => setShowAdd(false)} label={t('common.cancel')} variant="bare" icon={<X className="h-4 w-4" />} />
              </div>
              <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('economy.descriptionLabel')}</span><input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('economy.expenseTitlePlaceholder')} autoFocus className="input" /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('economy.amountLabel')}</span><input type="number" min="1" step="1" inputMode="decimal" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canAddExpense && void handleAddExpense()} placeholder={t('economy.expenseAmountPlaceholder')} className="input" /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('economy.categoryLabel')}</span><select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{translateKey('common.expenseCategories', c)}</option>)}</select></label>
              {members.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Users className="h-3 w-3" /> {t('economy.splitWith')}</p>
                  <div className="flex gap-2 flex-wrap">
                    {members.map((m) => (
                      <button key={m} onClick={() => toggleSplit(m)}
                        className={`min-h-11 px-3 py-2 rounded-full text-xs font-medium transition-all ${
                          newSplit.includes(m) ? 'gradient-primary text-ink-foreground' : 'glass text-muted-foreground'
                        }`}>
                        {m}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{t('economy.splitSummary', { count: newSplit.length })}</p>
                </div>
              )}
              <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('economy.deadlineDateLabel')}</span><input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} className="input text-muted-foreground" /></label>
              <button onClick={handleAddExpense} disabled={!canAddExpense} className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-ink-foreground disabled:opacity-50">
                {t('economy.addExpense')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {myHandles && !hasAnyMethod(myHandles) && (
        <button
          onClick={() => navigate('/profile?section=payment')}
          className="flex w-full items-center gap-3 rounded-[--r-lg] border border-dashed border-primary/40 bg-primary/5 p-3.5 text-left"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[--r-sm] bg-primary/15 text-primary">
            <Wallet className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t('economy.setupPayment.title')}</span>
            <span className="block text-xs text-muted-foreground">{t('economy.setupPayment.body')}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {/* Spending stats — where the household's money went, and how this month compares. All
          derived client-side from summary.expenses; see src/lib/expenseStats.ts. The ring answers
          "how is the month divided", the bars under it answer "which category is actually bigger". */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-2">
          <IconButton
            label={t('economy.stats.previousMonth')}
            variant="muted"
            onClick={() => setStatsMonth(shiftMonthKey(activeMonth, -1))}
            icon={<ChevronLeft className="h-4 w-4" />}
          />
          <div className="min-w-0 text-center">
            <p className="truncate font-display text-lg font-extrabold">
              {formatMonthYear(parseMonthKey(activeMonth).year, parseMonthKey(activeMonth).monthIndex)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('economy.stats.yourShare', { amount: formatCurrency(stats.breakdown.yourShare) })}
            </p>
          </div>
          <IconButton
            label={t('economy.stats.nextMonth')}
            variant="muted"
            onClick={() => setStatsMonth(shiftMonthKey(activeMonth, 1))}
            icon={<ChevronRight className="h-4 w-4" />}
          />
        </div>

        <MonthStrip months={stats.months} selectedKey={activeMonth} onSelect={setStatsMonth} animateIn={justFinishedLoading} />

        {stats.breakdown.categories.length > 0 ? (
          <>
            <CategoryDonut
              categories={stats.breakdown.categories}
              total={stats.breakdown.total}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              animateIn={justFinishedLoading}
            />
            <CategoryBars
              categories={stats.breakdown.categories}
              total={stats.breakdown.total}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              animateIn={justFinishedLoading}
            />
          </>
        ) : (
          <EmptyState
            tone="mint"
            icon={<PiggyBank className="h-6 w-6" />}
            title={t('economy.stats.emptyMonth')}
            body={t('economy.stats.emptyMonthBody')}
            action={{ label: t('economy.addExpense'), onClick: () => setShowAdd(true) }}
          />
        )}
      </section>

      {/* Budgets. Spend comes from the same client-side breakdown as the chart above; only the
          cap itself is persisted (see EconomyOperations.getBudgets/upsertBudget). */}
      <section className="card space-y-3">
        <div>
          <h3 className="font-display text-lg font-extrabold tracking-[-.02em]">{t('economy.budgets.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('economy.budgets.subtitle')}</p>
        </div>
        <BudgetBars budgets={budgets} spentByCategory={spentByCategory} onSave={handleSaveBudget} animateIn={justFinishedLoading} />
      </section>

      {/* Pant card. The goal was already a ratio in the data (currentAmount / goalAmount) but had
          only ever been rendered as two numbers in a sentence — a ring makes the progress visible. */}
      <motion.button
        onClick={() => navigate('/economy/pant')}
        {...pressableSubtle}
        className="card flex w-full items-center gap-3"
      >
        <ProgressRing value={pantPercent} size={54} thickness={7} color="var(--tone-mint)" trackColor="var(--surface-3)">
          <Recycle className="h-5 w-5 text-foreground" />
        </ProgressRing>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-bold">{t('economy.pantTracker')}</p>
          <p className="text-xs text-muted-foreground">
            {summary.pantSummary
              ? t('economy.pantTrackerSummary', {
                bottles: summary.pantSummary.entries.reduce((s, e) => s + e.bottles, 0),
                current: formatCurrency(summary.pantSummary.currentAmount),
                goal: formatCurrency(summary.pantSummary.goalAmount),
              })
              : t('economy.pantTrackerEmpty')}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </motion.button>

      {/* Your standing with each housemate — same pairwise model as the breakdown sheet */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
          {pairwiseKnown ? t('economy.yourStandings') : t('economy.balances')}
        </h3>
        <motion.div variants={listContainer} initial={justFinishedLoading ? "hidden" : false} animate="show" className="grid grid-cols-2 gap-2">
          {standings.map((b) => (
            <motion.div
              key={b.name}
              variants={listItem}
              className={`elev-1 flex items-center gap-2.5 rounded-xl border p-3 ${
                b.amount === 0 ? 'border-border bg-card' : b.amount > 0 ? 'tone-mint tone-wash tone-edge' : 'tone-blush tone-wash tone-edge'
              }`}
            >
              <Avatar name={b.name} className="h-9 w-9 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{b.name}</p>
                <p className={`flex items-center gap-1 text-sm font-bold ${b.amount >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {b.amount === 0 ? (
                    <>
                      {t('economy.settled')}
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    </>
                  ) : (
                    `${b.amount > 0 ? '+' : '-'} ${formatCurrency(Math.abs(b.amount))}`
                  )}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Expense history */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t('economy.expenseHistory')}</h3>
          {summary.expenses.length > 2 && (
            <button onClick={() => setShowAllExpenses((v) => !v)} className="pressable-tight px-1 text-xs text-primary dark:text-white font-medium">
              {showAllExpenses ? t('common.showLess') : t('common.seeAll')}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {(showAllExpenses ? summary.expenses : summary.expenses.slice(0, 2)).map((e, i) => (
            <div key={e.id}>
              <motion.div
                initial={justFinishedLoading ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: justFinishedLoading ? i * 0.04 : 0 }}
                onClick={() => { if (e.paidBy === name) startEdit(e); }}
                role={e.paidBy === name ? 'button' : undefined}
                tabIndex={e.paidBy === name ? 0 : undefined}
                className={`glass rounded-xl p-4 flex items-center gap-3 ${e.paidBy === name ? 'cursor-pointer' : ''}`}>
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {e.paidBy === name
                    ? <ArrowUpRight className="h-4 w-4 text-primary" />
                    : <ArrowDownLeft className="h-4 w-4 text-secondary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.paidBy} • {formatDate(e.date)} • <span className="text-accent">{translateKey('common.expenseCategories', e.category, e.category)}</span> • {t('economy.splitCount', { count: e.participantNames.length })}
                  </p>
                  {e.deadlineDate && (
                    <p className="text-[11px] text-destructive font-medium mt-0.5">
                      {t('economy.deadlineBadge', { date: formatDate(e.deadlineDate) })}
                    </p>
                  )}
                </div>
	                {e.paidBy === name ? (
	                  <div className="flex shrink-0 items-center gap-2" onClick={(event) => event.stopPropagation()}>
	                    <p className="text-sm font-bold">{formatCurrency(e.amount)}</p>
	                    <OverflowMenu
	                      label={t('common.actions')}
	                      actions={deletingExpenseId === e.id
	                        ? [
	                          {
	                            label: t('common.done'),
	                            icon: <Check className="h-4 w-4" />,
	                            destructive: true,
	                            onSelect: () => {
	                              void handleDeleteExpense(e.id);
	                            },
	                          },
	                          {
	                            label: t('common.cancel'),
	                            icon: <X className="h-4 w-4" />,
	                            onSelect: () => setDeletingExpenseId(null),
	                          },
	                        ]
	                        : [
	                          {
	                            label: t('economy.editExpense'),
	                            icon: <Pencil className="h-4 w-4" />,
	                            onSelect: () => startEdit(e),
	                          },
	                          {
	                            label: t('common.delete'),
	                            icon: <Trash2 className="h-4 w-4" />,
	                            destructive: true,
	                            onSelect: () => {
	                              setDeletingExpenseId(e.id);
	                              setEditingExpenseId(null);
	                            },
	                          },
	                        ]}
	                    />
	                  </div>
	                ) : (
                  <p className="text-sm font-bold shrink-0">{formatCurrency(e.amount)}</p>
                )}
              </motion.div>
              <AnimatePresence>
                {editingExpenseId === e.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="glass rounded-lg p-3 mt-1 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">{t('economy.editExpense')}</p>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={t('economy.expenseTitlePlaceholder')}
                        className="input" />
                      <input type="number" value={editAmount} onChange={(ev) => setEditAmount(ev.target.value)}
                        placeholder={t('economy.expenseAmountPlaceholder')}
                        className="input" />
                      <select value={editCategory} onChange={(ev) => setEditCategory(ev.target.value)}
                        className="input">
                        {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{translateKey('common.expenseCategories', c)}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="flex-1 gradient-primary rounded-lg py-2 text-sm font-semibold text-ink-foreground">
                          {t('economy.saveChanges')}
                        </button>
                        <button onClick={() => setEditingExpenseId(null)} className="flex-1 glass rounded-lg py-2 text-sm font-medium">
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
