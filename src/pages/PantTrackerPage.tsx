import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Recycle, Target, Edit3, Check, X, Plus, Pencil, Trash2, PartyPopper } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { qk } from "../lib/queryKeys";
import { queryClient as sharedQueryClient } from "../lib/queryClient";
import { connectCollectiveRealtime } from "../lib/realtime";
import { useUser } from "../context/UserContext";
import { formatCurrency, formatDate } from "../i18n/helpers";
import type { PantSummary, PantEntry } from "../lib/types";
import { CountUp, Eyebrow, OverflowMenu, ProgressBar, ProgressRing } from "../components/ui-kit";
import { celebrate } from "../lib/celebrate";

export default function PantTrackerPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useUser();
  // Seed from the warm React Query cache so re-entering the tab renders instantly instead
  // of flashing the loading skeleton on every navigation.
  const [pantSummary, setPantSummary] = useState<PantSummary | null>(
    () => sharedQueryClient.getQueryData<PantSummary>(qk.pant(currentUser?.name ?? "")) ?? null,
  );
  const [loading, setLoading] = useState(
    () => !sharedQueryClient.getQueryData(qk.pant(currentUser?.name ?? "")),
  );
  const [addAmount, setAddAmount] = useState("");
  const [editingTotal, setEditingTotal] = useState(false);
  const [editTotalValue, setEditTotalValue] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [editGoalValue, setEditGoalValue] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editBottles, setEditBottles] = useState("");
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  // Whether the goal was already met last render, so crossing the line fires once rather than on
  // every refetch while the goal stays met. Starts undefined so arriving at an already-met goal
  // is silent — the celebration belongs to the moment you reach it, not to opening the screen.
  const goalMetRef = useRef<boolean | undefined>(undefined);

  const name = currentUser?.name ?? "";
  const queryClient = useQueryClient();

  // Cached pant load — instant on re-navigation, refreshed in the background.
  const { data: pantData } = useQuery({
    queryKey: qk.pant(name),
    enabled: !!name,
    queryFn: () => api.get<PantSummary>(`/economy/pant?memberName=${encodeURIComponent(name)}`),
  });

  useEffect(() => {
    if (!pantData) return;
    setPantSummary(pantData);
    setLoading(false);
    const met = pantData.goalAmount > 0 && pantData.currentAmount >= pantData.goalAmount;
    const previously = goalMetRef.current;
    goalMetRef.current = met;
    if (previously === false && met) celebrate("goal-reached");
  }, [pantData]);

  const fetchPant = async () => {
    if (!name) return;
    void queryClient.invalidateQueries({ queryKey: qk.economy(name) });
    await queryClient.invalidateQueries({ queryKey: qk.pant(name) });
  };

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(
      name,
      (event) => {
        if (["PANT_ADDED", "PANT_UPDATED", "PANT_DELETED"].includes(event.type)) {
          fetchPant();
        }
      },
      { onReconnected: () => fetchPant() },
    );
    return disconnect;
  }, [name]);

  const handleAdd = async () => {
    const parsed = Math.round(Number(addAmount));
    if (!Number.isFinite(parsed) || parsed === 0) return;
    const body = { bottles: parsed, amount: parsed, addedBy: name, date: new Date().toISOString().split("T")[0] };
    // Optimistic: reflect the new entry and running total at once; fetchPant reconciles.
    const tempId = -Date.now();
    const optimistic: PantEntry = { id: tempId, ...body };
    setPantSummary((prev) => (prev ? { ...prev, currentAmount: prev.currentAmount + parsed, entries: [optimistic, ...prev.entries] } : prev));
    setAddAmount("");
    try {
      await api.post("/economy/pant", body);
      fetchPant();
    } catch {
      setPantSummary((prev) => (prev ? { ...prev, currentAmount: prev.currentAmount - parsed, entries: prev.entries.filter((e) => e.id !== tempId) } : prev));
      setAddAmount(String(parsed));
    }
  };

  const handleEditTotal = async () => {
    const newTotal = Math.round(Number(editTotalValue));
    if (!Number.isFinite(newTotal)) return;
    const diff = newTotal - earned;
    if (diff !== 0) {
      await api.post("/economy/pant", {
        bottles: diff,
        amount: diff,
        addedBy: name,
        date: new Date().toISOString().split("T")[0],
      });
      fetchPant();
    }
    setEditingTotal(false);
  };

  const startEditEntry = (id: number, bottles: number) => {
    setEditingEntryId(id);
    setEditBottles(String(bottles));
    setDeletingEntryId(null);
  };

  const handleSaveEntry = async () => {
    if (!editingEntryId) return;
    const parsed = Math.round(Number(editBottles));
    if (!Number.isFinite(parsed) || parsed === 0) return;
    await api.patch(`/economy/pant/${editingEntryId}`, { bottles: parsed, amount: parsed });
    setEditingEntryId(null);
    fetchPant();
  };

  const handleDeleteEntry = async (id: number) => {
    await api.delete(`/economy/pant/${id}`);
    setDeletingEntryId(null);
    fetchPant();
  };

  const handleEditGoal = async () => {
    const newGoal = Math.round(Number(editGoalValue));
    if (!Number.isFinite(newGoal) || newGoal <= 0) return;
    await api.patch("/economy/pant/goal", { memberName: name, goal: newGoal });
    fetchPant();
    setEditingGoal(false);
  };

  if (loading || !pantSummary) {
    return (
      <div className="space-y-4 pt-4 animate-pulse">
        <div className="glass rounded-2xl h-48" />
        <div className="glass rounded-2xl h-32" />
      </div>
    );
  }

  const totalBottles = pantSummary.entries.reduce((s, e) => s + e.bottles, 0);
  const earned = pantSummary.currentAmount;
  const goal = pantSummary.goalAmount;
  const progress = Math.min((earned / goal) * 100, 100);

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 pt-4"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/economy")}
          className="pressable-tight h-9 w-9 rounded-xl glass flex items-center justify-center"
          aria-label={t("common.back")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <Eyebrow>{t("pant.eyebrow")}</Eyebrow>
          <h2 className="display-md">{t("pant.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("pant.subtitle", { goal: formatCurrency(goal) })}
          </p>
        </div>
      </div>

      {/* Counter */}
      <div className="househero text-center">
        <Recycle className="h-8 w-8 text-secondary mx-auto mb-2" />
        <p className="font-display text-5xl font-bold">{totalBottles}</p>
        <p className="text-sm text-white/70 mt-1">
          {t('pant.bottlesCollected')}
        </p>

        {editingTotal ? (
          <div className="flex items-center justify-center gap-2 mt-3">
            <input
              type="number"
              value={editTotalValue}
              onChange={(e) => setEditTotalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleEditTotal();
                if (e.key === "Escape") setEditingTotal(false);
              }}
              className="w-28 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-center text-white placeholder:text-white/60 focus:outline-none focus:ring-1 focus:ring-secondary"
              autoFocus
            />
            <button
              onClick={() => void handleEditTotal()}
              className="h-11 w-11 rounded-lg gradient-primary flex items-center justify-center shrink-0"
            >
              <Check className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
            <button
              onClick={() => setEditingTotal(false)}
              className="h-11 w-11 rounded-lg glass flex items-center justify-center shrink-0"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mt-2">
            <p className="font-display text-xl font-bold text-secondary">
              {formatCurrency(earned)}
            </p>
            <button
              onClick={() => { setEditTotalValue(String(earned)); setEditingTotal(true); }}
              className="h-11 w-11 rounded-md glass flex items-center justify-center"
            >
              <Edit3 className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}

        <p className="text-xs text-white/70 mt-0.5">{t('pant.earnedSoFar')}</p>

        <div className="flex items-center justify-center gap-2 mt-4">
          <input
            type="number"
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
            placeholder={t('pant.customAmount')}
            onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
            className="w-36 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-center text-white placeholder:text-white/60 focus:outline-none focus:ring-1 focus:ring-secondary"
          />
          <button
            onClick={() => void handleAdd()}
            className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center shrink-0"
            aria-label={t('pant.addAmount')}
          >
            <Plus className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>

      {/* Goal */}
      <div className="glass rounded-2xl p-4 glow-accent">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold flex-1">{t("pant.savingGoal")}</p>
          {!editingGoal && (
            <button
              onClick={() => { setEditGoalValue(String(goal)); setEditingGoal(true); }}
              className="h-11 w-11 rounded-md glass flex items-center justify-center"
            >
              <Edit3 className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        {editingGoal ? (
          <div className="flex items-center gap-2 mb-3">
            <input
              type="number"
              value={editGoalValue}
              onChange={(e) => setEditGoalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleEditGoal();
                if (e.key === "Escape") setEditingGoal(false);
              }}
              className="flex-1 bg-muted/50 rounded-lg px-3 py-1.5 text-sm text-center placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button
              onClick={() => void handleEditGoal()}
              className="h-11 w-11 rounded-lg gradient-primary flex items-center justify-center shrink-0"
            >
              <Check className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
            <button
              onClick={() => setEditingGoal(false)}
              className="h-11 w-11 rounded-lg glass flex items-center justify-center shrink-0"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 font-display font-bold text-lg">
            {t("pant.goalTitle")}
            <PartyPopper className="h-4 w-4 shrink-0 text-primary" />
          </p>
        )}
        {/* The goal ring. This screen is entirely about closing a gap, and it reported that gap as
            two numbers either side of a 8px bar — the one place in the app a ring was most obviously
            missing. */}
        <div className="mt-3 flex items-center gap-4">
          <ProgressRing value={progress} size={104} thickness={11} color="var(--tone-mint)">
            <div>
              <CountUp value={Math.round(progress)} className="font-display text-2xl font-extrabold" />
              <span className="block text-[9px] font-bold tracking-[.14em] text-muted-foreground">%</span>
            </div>
          </ProgressRing>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">{t("pant.saved", { amount: formatCurrency(earned) })}</p>
            <p className="text-xs text-muted-foreground">{t("pant.goal", { amount: formatCurrency(goal) })}</p>
            <ProgressBar value={progress} className="mt-2" />
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {progress >= 100 ? (
            <>
              <PartyPopper className="h-3.5 w-3.5 shrink-0 text-primary" />
              {t("pant.goalReached")}
            </>
          ) : (
            t("pant.bottlesToGo", { count: Math.ceil((goal - earned) / 1) })
          )}
        </p>
      </div>

      {/* History */}
      {pantSummary.entries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {t("pant.collectionHistory")}
            </h3>
            {pantSummary.entries.length > 2 && (
              <button onClick={() => setShowAllHistory((v) => !v)} className="text-xs text-primary font-medium">
                {showAllHistory ? t('common.showLess') : t('common.seeAll')}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(showAllHistory ? pantSummary.entries : pantSummary.entries.slice(0, 2)).map((entry, i) => (
              <div key={entry.id}>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl p-3 flex items-center gap-3"
                >
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Recycle className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {t("pant.historyEntry", {
                        name: entry.addedBy,
                        count: entry.bottles,
                      })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(entry.date)}
                    </p>
                  </div>
	                  {entry.addedBy === name ? (
	                    <div className="flex shrink-0 items-center gap-2">
	                      <p className="text-sm font-bold text-primary">+{formatCurrency(entry.amount)}</p>
	                      <OverflowMenu
	                        label={t("common.actions")}
	                        actions={deletingEntryId === entry.id
	                          ? [
	                            {
	                              label: t("common.done"),
	                              icon: <Check className="h-4 w-4" />,
	                              destructive: true,
	                              onSelect: () => {
	                                void handleDeleteEntry(entry.id);
	                              },
	                            },
	                            {
	                              label: t("common.cancel"),
	                              icon: <X className="h-4 w-4" />,
	                              onSelect: () => setDeletingEntryId(null),
	                            },
	                          ]
	                          : [
	                            {
	                              label: t("pant.editEntry"),
	                              icon: <Pencil className="h-4 w-4" />,
	                              onSelect: () => startEditEntry(entry.id, entry.bottles),
	                            },
	                            {
	                              label: t("common.delete"),
	                              icon: <Trash2 className="h-4 w-4" />,
	                              destructive: true,
	                              onSelect: () => {
	                                setDeletingEntryId(entry.id);
	                                setEditingEntryId(null);
	                              },
	                            },
	                          ]}
	                      />
	                    </div>
	                  ) : (
                    <p className="text-sm font-bold text-primary shrink-0">+{formatCurrency(entry.amount)}</p>
                  )}
                </motion.div>
                <AnimatePresence>
                  {editingEntryId === entry.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="glass rounded-xl p-3 mt-1 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">{t("pant.editEntry")}</p>
                        <input
                          type="number"
                          value={editBottles}
                          onChange={(e) => setEditBottles(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") void handleSaveEntry(); if (e.key === "Escape") setEditingEntryId(null); }}
                          placeholder={t("pant.bottlesPlaceholder")}
                          className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button onClick={() => void handleSaveEntry()} className="flex-1 gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground">
                            {t("economy.saveChanges")}
                          </button>
                          <button onClick={() => setEditingEntryId(null)} className="flex-1 glass rounded-lg py-2 text-sm font-medium">
                            {t("common.cancel")}
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
      )}
    </motion.div>
  );
}
