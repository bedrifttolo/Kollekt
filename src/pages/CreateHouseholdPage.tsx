import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronUp, Plus, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, getUserMessage } from '../lib/api';
import { useUser } from '../context/UserContext';
import type { AppUser } from '../lib/types';
import { BrandMark, Field } from '../components/ui-kit';
import TourOverlay, { type TourStep } from '../components/TourOverlay';

type RoomDraft = { id: number; emoji: string; name: string; minutes: string };

const CODE_LENGTH = 6;

const ONBOARDING_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="onb-mode"]', titleKey: 'tour.onboarding.mode.title', bodyKey: 'tour.onboarding.mode.body' },
  { selector: '[data-tour="onb-name"]', titleKey: 'tour.onboarding.name.title', bodyKey: 'tour.onboarding.name.body' },
  { selector: '[data-tour="onb-rooms"]', titleKey: 'tour.onboarding.rooms.title', bodyKey: 'tour.onboarding.rooms.body' },
  { selector: '[data-tour="onb-create"]', titleKey: 'tour.onboarding.create.title', bodyKey: 'tour.onboarding.create.body' },
];

// Common shared rooms offered as one-tap suggestions, with realistic clean times (min = XP).
const ROOM_SUGGESTIONS: Array<{ key: string; emoji: string; minutes: string }> = [
  { key: 'kitchen', emoji: '🍳', minutes: '20' },
  { key: 'bathroom', emoji: '🚿', minutes: '15' },
  { key: 'livingRoom', emoji: '🛋️', minutes: '10' },
  { key: 'toilet', emoji: '🚽', minutes: '10' },
  { key: 'hallway', emoji: '🚪', minutes: '10' },
  { key: 'laundry', emoji: '🧺', minutes: '10' },
  { key: 'diningRoom', emoji: '🍽️', minutes: '10' },
  { key: 'balcony', emoji: '🪴', minutes: '10' },
  { key: 'stairs', emoji: '🧹', minutes: '10' },
];

export default function CreateHouseholdPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, setCurrentUser, handleLogout } = useUser();

  const roomId = useRef(0);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [houseName, setHouseName] = useState('');
  const [address, setAddress] = useState('');
  const [roomsOpen, setRoomsOpen] = useState(true);
  const [rooms, setRooms] = useState<RoomDraft[]>([]);
  const [code, setCode] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const xpFor = (minutes: string) => Math.max(1, parseInt(minutes, 10) || 0);

  const addRoom = () =>
    setRooms((p) => [...p, { id: roomId.current++, emoji: '🧹', name: '', minutes: '15' }]);
  const addSuggested = (s: { key: string; emoji: string; minutes: string }) =>
    setRooms((p) => [
      ...p,
      { id: roomId.current++, emoji: s.emoji, name: t(`createHousehold.defaultRooms.${s.key}`), minutes: s.minutes },
    ]);
  const suggestions = ROOM_SUGGESTIONS.filter(
    (s) => !rooms.some((r) => r.name.trim().toLowerCase() === t(`createHousehold.defaultRooms.${s.key}`).toLowerCase()),
  );
  const removeRoom = (id: number) => setRooms((p) => p.filter((r) => r.id !== id));
  const updateRoom = (id: number, patch: Partial<RoomDraft>) =>
    setRooms((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const setCodeChar = (index: number, raw: string) => {
    const char = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-1);
    setCode((prev) => prev.map((c, i) => (i === index ? char : c)));
    if (char && index < CODE_LENGTH - 1) codeRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) codeRefs.current[index - 1]?.focus();
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const chars = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH).split('');
    if (!chars.length) return;
    setCode(Array.from({ length: CODE_LENGTH }, (_, i) => chars[i] ?? ''));
    codeRefs.current[Math.min(chars.length, CODE_LENGTH - 1)]?.focus();
  };

  const joinCode = code.join('');

  const handleCreate = async () => {
    if (!currentUser) return;
    setError('');
    const roomConfigs = rooms
      .map((r) => ({ name: r.name.trim(), minutes: xpFor(r.minutes) }))
      .filter((r) => r.name);

    if (roomConfigs.length === 0) {
      setError(t('createHousehold.errors.addRoom'));
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ joinCode: string }>('/onboarding/collectives', {
        name: houseName.trim() || t('createHousehold.defaultHouseholdName'),
        address: address.trim() || undefined,
        ownerUserId: currentUser.id,
        numRooms: roomConfigs.length,
        residents: [currentUser.name],
        rooms: roomConfigs,
      });
      setCurrentUser({ ...currentUser, collectiveCode: res.joinCode } as AppUser);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(getUserMessage(err, t('createHousehold.errors.createFailure')));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!currentUser || joinCode.length < CODE_LENGTH) return;
    setError('');
    setLoading(true);
    try {
      const joined = await api.post<AppUser>('/onboarding/collectives/join', {
        userId: currentUser.id,
        joinCode,
      });
      setCurrentUser(joined);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(getUserMessage(err, t('createHousehold.errors.joinFailure')));
    } finally {
      setLoading(false);
    }
  };

  const goBackToAuth = async () => {
    await handleLogout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-viewport bg-background flex flex-col px-6 safe-top safe-bottom">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto flex flex-1 flex-col pt-8"
      >
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-7 text-primary dark:text-foreground" />
          <span className="font-display text-2xl font-extrabold text-primary dark:text-secondary">Kollekt</span>
        </div>

        <h1 className="mt-7 font-display text-[2.75rem] leading-[.96] font-extrabold tracking-[-.05em]">
          {t('createHousehold.headingPre')} <span className="mark">{t('createHousehold.headingMark1')}</span>{' '}
          <span className="mark">{t('createHousehold.headingMark2')}</span>
        </h1>

        <div className="seg mt-6" data-tour="onb-mode">
          {(['create', 'join'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2.5 rounded-[.85rem] text-sm font-bold transition-all ${
                mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {m === 'create' ? t('createHousehold.tabCreate') : t('createHousehold.tabJoin')}
            </button>
          ))}
        </div>

        {mode === 'create' ? (
          <div className="mt-4 space-y-4">
            <div data-tour="onb-name">
              <Field
                label={t('createHousehold.householdName')}
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                placeholder={t('createHousehold.householdNamePlaceholder')}
              />
            </div>

            <Field
              label={t('createHousehold.address')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('createHousehold.addressPlaceholder')}
            />

            <div data-tour="onb-rooms">
              <button
                type="button"
                onClick={() => setRoomsOpen((v) => !v)}
                className="flex w-full items-center gap-2 text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground"
              >
                <ChevronUp className={`h-4 w-4 transition-transform ${roomsOpen ? '' : 'rotate-180'}`} />
                {t('createHousehold.roomsHeader')}
              </button>

              {roomsOpen && (
                <div className="mt-3 space-y-3">
                  {rooms.map((room) => (
                    <div key={room.id} className="field flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-xl">{room.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <input
                          value={room.name}
                          onChange={(e) => updateRoom(room.id, { name: e.target.value })}
                          placeholder={t('createHousehold.defaultRooms.kitchen')}
                          className="w-full bg-transparent font-bold text-base placeholder:text-muted-foreground/60 focus:outline-none"
                        />
                        <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{t('createHousehold.cleaningTimeLabel')}:</span>
                          <input
                            type="number"
                            min={1}
                            max={240}
                            value={room.minutes}
                            onChange={(e) => updateRoom(room.id, { minutes: e.target.value })}
                            className="w-12 rounded-md border border-border bg-background px-1.5 py-0.5 text-center text-sm font-bold tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            aria-label={t('createHousehold.minLabel')}
                          />
                          <span>{t('createHousehold.minutesShort')}</span>
                        </label>
                      </div>
                      <span className="shrink-0 font-display font-extrabold text-primary dark:text-secondary">
                        {xpFor(room.minutes)} XP
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRoom(room.id)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                        aria-label={t('createHousehold.removeRoom')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {suggestions.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('createHousehold.roomExamplesLabel')}</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((s) => (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => addSuggested(s)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-sm font-bold text-foreground transition-colors hover:bg-primary/10"
                          >
                            <Plus className="h-3.5 w-3.5 text-primary" />
                            <span>{s.emoji}</span>
                            {t(`createHousehold.defaultRooms.${s.key}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {rooms.length > 0 && (
                    <p className="text-xs text-muted-foreground">{t('createHousehold.cleaningTimeHint')}</p>
                  )}

                  <button
                    type="button"
                    onClick={addRoom}
                    className="flex w-full items-center justify-center gap-2 rounded-[1.15rem] border border-dashed border-border py-3.5 text-sm font-bold text-muted-foreground"
                  >
                    <Plus className="h-4 w-4" /> {t('createHousehold.addRoom')}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-[1.15rem] bg-primary/10 p-3.5 text-sm text-muted-foreground">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary dark:text-secondary" />
              <p>
                {t('createHousehold.rotationNotePrefix')}
                <strong className="text-foreground">{t('createHousehold.rotationNoteBold')}</strong>
                {t('createHousehold.rotationNoteSuffix')}
              </p>
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <button type="button" data-tour="onb-create" onClick={handleCreate} disabled={loading} className="btn-lemon w-full font-bold disabled:opacity-60">
              {loading ? t('createHousehold.creating') : t('createHousehold.createCta')}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-center text-base text-muted-foreground">{t('createHousehold.joinIntro')}</p>

            <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
              {code.map((char, i) => (
                <input
                  key={i}
                  ref={(el) => { codeRefs.current[i] = el; }}
                  value={char}
                  onChange={(e) => setCodeChar(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  inputMode="text"
                  autoCapitalize="characters"
                  maxLength={1}
                  aria-label={`${i + 1}`}
                  placeholder="·"
                  className={`h-14 w-12 rounded-2xl border-2 bg-card text-center font-display text-2xl font-extrabold focus:outline-none ${
                    char
                      ? 'border-primary text-primary dark:border-secondary dark:text-secondary'
                      : 'border-border text-muted-foreground placeholder:text-muted-foreground/50'
                  }`}
                />
              ))}
            </div>

            <div className="rounded-[1.15rem] bg-primary/10 p-3.5 text-center text-sm text-muted-foreground">
              {t('createHousehold.joinNote')}
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <button
              type="button"
              onClick={handleJoin}
              disabled={loading || joinCode.length < CODE_LENGTH}
              className="btn-lemon w-full font-bold disabled:opacity-60"
            >
              {loading ? t('createHousehold.joining') : t('createHousehold.joinCta')}
            </button>
          </div>
        )}

        <button type="button" onClick={goBackToAuth} className="mt-auto pt-8 pb-2 text-center text-sm font-bold text-muted-foreground">
          {t('createHousehold.backToAuth')}
        </button>
      </motion.div>
      {mode === 'create' && <TourOverlay steps={ONBOARDING_TOUR_STEPS} storageKey="kollekt_onboarding_tour_v2" />}
    </div>
  );
}
