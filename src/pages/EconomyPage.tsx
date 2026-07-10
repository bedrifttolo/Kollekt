import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, Check, Recycle, ChevronRight, X, Users, Pencil, Trash2, Copy, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { qk } from '../lib/queryKeys';
import { queryClient as sharedQueryClient } from '../lib/queryClient';
import { useUser } from '../context/UserContext';
import { formatCurrency, formatDate, translateKey } from '../i18n/helpers';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { EconomySummary, Expense, PayOption } from '../lib/types';
import { Eyebrow, Fab, OverflowMenu } from '../components/ui-kit';
import { colorForMember } from '../lib/memberColors';
import { availableMethods, hasAnyMethod, openPaymentLink } from '../lib/paymentLinks';

const PROVIDER_LABELS: Record<string, string> = {
  vipps: 'Vipps',
  mobilepay: 'MobilePay',
  paypal: 'PayPal',
  bank: 'economy.pay.bankTransfer',
};

const EXPENSE_CATEGORIES = ['Groceries', 'Bills', 'Cleaning', 'Entertainment', 'Food', 'Other'];

export default function EconomyPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useUser();
  // Seed from the React Query cache so re-entering the tab renders instantly from the
  // warm cache instead of flashing the loading skeleton on every navigation.
  const [summary, setSummary] = useState<EconomySummary | null>(
    () => sharedQueryClient.getQueryData<EconomySummary>(qk.economy(currentUser?.name ?? '')) ?? null,
  );
  const [members, setMembers] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('Other');
  const [newSplit, setNewSplit] = useState<string[]>([]);
  const [loading, setLoading] = useState(
    () => !sharedQueryClient.getQueryData(qk.economy(currentUser?.name ?? '')),
  );
  const [settling, setSettling] = useState(false);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
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
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [settlementAcknowledged, setSettlementAcknowledged] = useState(false);

  const name = currentUser?.name ?? '';
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

  useEffect(() => {
    if (!name) return;
    api.get<{ name: string }[]>(`/members/collective?memberName=${encodeURIComponent(name)}`)
      .then((res) => {
        const names = res.map((m) => m.name);
        setMembers(names);
        setNewSplit(names);
      })
      .catch(() => {});
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (['EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED', 'BALANCES_SETTLED', 'PANT_ADDED'].includes(event.type)) {
        fetchSummary();
      }
    });
    return disconnect;
  }, [name]);

  const toggleSplit = (member: string) =>
    setNewSplit((prev) => prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]);

  const handleAddExpense = async () => {
    if (!canAddExpense) return;
    await api.post<Expense>('/economy/expenses', {
      description: newTitle.trim(),
      amount: Math.round(parsedNewAmount),
      paidBy: name,
      category: newCategory,
      date: new Date().toISOString().split('T')[0],
      participantNames: newSplit.length > 0 ? newSplit : [name],
      ...(newDeadline ? { deadlineDate: newDeadline } : {}),
    });
    setNewTitle(''); setNewAmount(''); setNewCategory('Other'); setNewSplit(members); setNewDeadline('');
    setShowAdd(false);
    fetchSummary();
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
    if (!selectedPayOption || !settlementAcknowledged) return;
    setSettling(true);
    try {
      await api.post('/economy/settle-with', { creditorName: selectedPayOption.name });
      setShowPaySheet(false);
      setSettlementAcknowledged(false);
      fetchSummary();
    } catch {}
    setSettling(false);
  };

  const handlePayCreditor = () => {
    if (!selectedPayOption) return;
    setSettlementAcknowledged(false);
    setShowPaySheet(true);
  };

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue((v) => (v === value ? null : v)), 1500);
    } catch {}
  };

  if (loading || !summary) {
    return <div className="space-y-3 pt-4 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="glass rounded-2xl h-20" />)}</div>;
  }

  const myBalance = summary.balances.find((b) => b.name === name);
  const oweAmount = myBalance && myBalance.amount < 0 ? Math.abs(myBalance.amount) : 0;
  const getAmount = myBalance && myBalance.amount > 0 ? myBalance.amount : 0;
  const fallbackCreditor = summary.balances.find((b) => b.amount > 0 && b.name !== name);
  const selectedPayOption = payOptions.find((option) => option.name === selectedCreditorName) ?? payOptions[0];
  const hasPayOptions = payOptions.length > 0;

  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-4">
      <div>
        <Eyebrow>{t('economy.eyebrow')}</Eyebrow>
        <h2 className="mt-2 font-display text-[2.4rem] font-extrabold leading-none tracking-[-.04em]">{t('economy.titleLineOne')} <span className="mark">{t('economy.titleLineTwo')}</span></h2>
      </div>

      {/* Balance card */}
      <div className="wallet">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-white/65 mb-1">{t('economy.yourBalance')}</p>
        <p className={`font-display text-3xl font-bold ${oweAmount > 0 ? 'text-destructive' : getAmount > 0 ? 'text-primary' : 'text-foreground'}`}>
          {oweAmount > 0 ? `- ${formatCurrency(oweAmount)}` : getAmount > 0 ? `+ ${formatCurrency(getAmount)}` : formatCurrency(0)}
        </p>
        <p className="text-xs text-white/70 mt-1">
          {hasPayOptions && selectedPayOption ? t('economy.owe', { name: selectedPayOption.name, amount: formatCurrency(selectedPayOption.amount) })
          : oweAmount > 0 && fallbackCreditor ? t('economy.owe', { name: fallbackCreditor.name, amount: formatCurrency(oweAmount) })
          : getAmount > 0 ? t('economy.othersOweYou')
          : `${t('economy.allSettled')} ✅`}
        </p>
        {hasPayOptions && selectedPayOption && (
          <div className="mt-4 space-y-2.5">
            {payOptions.length > 1 && (
              <select
                value={selectedPayOption.name}
                onChange={(e) => setSelectedCreditorName(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
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
              <button onClick={handlePayCreditor} disabled={settling || !selectedPayOption}
                className="btn-lemon w-full disabled:opacity-60">
                <Check className="h-4 w-4" /> {t('economy.payAmountTo', { name: selectedPayOption.name, amount: formatCurrency(selectedPayOption.amount) })}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pay sheet — deep-links to the creditor's payment apps; Kollekt never moves money */}
      <AnimatePresence>
        {showPaySheet && selectedPayOption && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            onClick={() => setShowPaySheet(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="glass w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:pb-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{t('economy.pay.title', { name: selectedPayOption.name })}</p>
                  <p className="text-xs text-muted-foreground">{t('economy.pay.subtitle', { amount: formatCurrency(selectedPayOption.amount) })}</p>
                </div>
                <button onClick={() => setShowPaySheet(false)} aria-label={t('common.cancel')}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-2">
                {!hasAnyMethod(selectedPayOption.handles) && (
                  <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                    {t('economy.pay.noMethods')}
                  </p>
                )}
                {availableMethods(selectedPayOption.handles, selectedPayOption.amount).map((m) => {
                  const label = PROVIDER_LABELS[m.provider];
                  const display = label.includes('.') ? t(label) : label;
                  return (
                    <div key={m.provider} className="glass rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{display}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.value}</p>
                      </div>
                      <button
                        onClick={() => void copyValue(m.value)}
                        className="h-9 w-9 rounded-lg glass flex items-center justify-center shrink-0"
                        aria-label={t('economy.pay.copy')}
                      >
                        {copiedValue === m.value ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {m.url && (
                        <button
                          onClick={() => void openPaymentLink(m.url!)}
                          className="rounded-lg gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground flex items-center gap-1.5 shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> {t('economy.pay.open')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-muted-foreground">{t('economy.pay.disclaimer')}</p>

              <label className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={settlementAcknowledged}
                  onChange={(event) => setSettlementAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>{t('economy.pay.acknowledge')}</span>
              </label>

              <button
                onClick={() => void handleMarkSettled()}
                disabled={settling || !settlementAcknowledged}
                className="w-full gradient-primary rounded-xl py-2.5 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Check className="h-4 w-4" /> {t('economy.pay.markSettled')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showAdd && <Fab onClick={() => setShowAdd(true)} label={t('economy.newExpense')} />}

      {/* Add expense form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t('economy.newExpense')}</p>
                <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('economy.descriptionLabel')}</span><input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('economy.expenseTitlePlaceholder')} autoFocus className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('economy.amountLabel')}</span><input type="number" min="1" step="1" inputMode="decimal" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder={t('economy.expenseAmountPlaceholder')} className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('economy.categoryLabel')}</span><select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{translateKey('common.expenseCategories', c)}</option>)}</select></label>
              {members.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Users className="h-3 w-3" /> {t('economy.splitWith')}</p>
                  <div className="flex gap-2 flex-wrap">
                    {members.map((m) => (
                      <button key={m} onClick={() => toggleSplit(m)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          newSplit.includes(m) ? 'gradient-primary text-primary-foreground' : 'glass text-muted-foreground'
                        }`}>
                        {m}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">{t('economy.splitSummary', { count: newSplit.length })}</p>
                </div>
              )}
              <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">{t('economy.deadlineDateLabel')}</span><input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></label>
              <button onClick={handleAddExpense} disabled={!canAddExpense} className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {t('economy.addExpense')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pant card */}
      <button onClick={() => navigate('/economy/pant')}
        className="w-full glass rounded-2xl p-4 flex items-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-transform glow-accent">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent/30 to-accent/5 flex items-center justify-center shrink-0">
          <Recycle className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold">{t('economy.pantTracker')}</p>
          <p className="text-[10px] text-muted-foreground">
            {summary.pantSummary
              ? t('economy.pantTrackerSummary', {
                bottles: summary.pantSummary.entries.reduce((s, e) => s + e.bottles, 0),
                current: formatCurrency(summary.pantSummary.currentAmount),
                goal: formatCurrency(summary.pantSummary.goalAmount),
              })
              : t('economy.pantTrackerEmpty')}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Balances */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('economy.balances')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {summary.balances.map((b) => (
            <motion.div key={b.name} className="glass rounded-xl p-3 flex items-center gap-2">
              <div style={{ backgroundColor: colorForMember(b.name) }} className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
                {b.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{b.name}</p>
                <p className={`text-sm font-bold ${b.amount >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {b.amount === 0 ? `${t('economy.settled')} ✓` : `${b.amount > 0 ? '+' : '-'} ${formatCurrency(Math.abs(b.amount))}`}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Expense history */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t('economy.expenseHistory')}</h3>
          {summary.expenses.length > 2 && (
            <button onClick={() => setShowAllExpenses((v) => !v)} className="text-xs text-primary font-medium">
              {showAllExpenses ? t('common.showLess') : t('common.seeAll')}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {(showAllExpenses ? summary.expenses : summary.expenses.slice(0, 2)).map((e, i) => (
            <div key={e.id}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="glass rounded-xl p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {e.paidBy === name
                    ? <ArrowUpRight className="h-4 w-4 text-primary" />
                    : <ArrowDownLeft className="h-4 w-4 text-secondary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {e.paidBy} • {formatDate(e.date)} • <span className="text-accent">{translateKey('common.expenseCategories', e.category, e.category)}</span> • {t('economy.splitCount', { count: e.participantNames.length })}
                  </p>
                  {e.deadlineDate && (
                    <p className="text-[10px] text-destructive font-medium mt-0.5">
                      {t('economy.deadlineBadge', { date: formatDate(e.deadlineDate) })}
                    </p>
                  )}
                </div>
	                {e.paidBy === name ? (
	                  <div className="flex shrink-0 items-center gap-2">
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
                    <div className="glass rounded-xl p-3 mt-1 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">{t('economy.editExpense')}</p>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={t('economy.expenseTitlePlaceholder')}
                        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <input type="number" value={editAmount} onChange={(ev) => setEditAmount(ev.target.value)}
                        placeholder={t('economy.expenseAmountPlaceholder')}
                        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <select value={editCategory} onChange={(ev) => setEditCategory(ev.target.value)}
                        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                        {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{translateKey('common.expenseCategories', c)}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="flex-1 gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground">
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
