import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronUp, Plus, RefreshCw, X } from 'lucide-react';
import { DEFAULT_ROOM_ICON, ROOM_TYPE_ICONS } from '../lib/categoryIcons';
import { toneByIndex, toneByKey, toneClass } from '../lib/tones';
import { useTranslation } from 'react-i18next';
import { api, getUserMessage, setAccessToken, setRefreshToken } from '../lib/api';
import { useUser } from '../context/UserContext';
import type { AppUser, AuthResponse } from '../lib/types';
import { BrandMark, Field } from '../components/ui-kit';
import TourOverlay, { type TourStep } from '../components/TourOverlay';

type RoomDraft = { id: number; iconKey: string; name: string; minutes: string };

const CODE_LENGTH = 6;

const ONBOARDING_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="onb-mode"]', titleKey: 'tour.onboarding.mode.title', bodyKey: 'tour.onboarding.mode.body' },
  { selector: '[data-tour="onb-name"]', titleKey: 'tour.onboarding.name.title', bodyKey: 'tour.onboarding.name.body' },
  { selector: '[data-tour="onb-rooms"]', titleKey: 'tour.onboarding.rooms.title', bodyKey: 'tour.onboarding.rooms.body' },
  { selector: '[data-tour="onb-create"]', titleKey: 'tour.onboarding.create.title', bodyKey: 'tour.onboarding.create.body' },
];

// Common shared rooms offered as one-tap suggestions, with realistic clean times (min = XP).
const ROOM_SUGGESTIONS: Array<{ key: string; minutes: string }> = [
  { key: 'kitchen', minutes: '20' },
  { key: 'bathroom', minutes: '15' },
  { key: 'livingRoom', minutes: '10' },
  { key: 'toilet', minutes: '10' },
  { key: 'hallway', minutes: '10' },
  { key: 'laundry', minutes: '10' },
  { key: 'diningRoom', minutes: '10' },
  { key: 'balcony', minutes: '10' },
  { key: 'stairs', minutes: '10' },
];

export default function CreateHouseholdPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, setCurrentUser, handleLogout } = useUser();

  const roomId = useRef(0);
  // Apple and Google can't be relied on for a usable display name, so a fresh account confirms
  // one here — the last moment it is safe to change, before any collective-scoped row references
  // the member by name. Prefilled with whatever the provider gave us.
  const [step, setStep] = useState<'name' | 'household'>('name');
  const [displayName, setDisplayName] = useState(currentUser?.name ?? '');
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
    setRooms((p) => [...p, { id: roomId.current++, iconKey: 'custom', name: '', minutes: '15' }]);
  const addSuggested = (s: { key: string; minutes: string }) =>
    setRooms((p) => [
      ...p,
      { id: roomId.current++, iconKey: s.key, name: t(`createHousehold.defaultRooms.${s.key}`), minutes: s.minutes },
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

  const handleConfirmName = async () => {
    if (!currentUser) return;
    const name = displayName.trim();
    if (!name) {
      setError(t('createHousehold.errors.nameRequired'));
      return;
    }
    if (name === currentUser.name) {
      setStep('household');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await api.patch<AuthResponse>('/onboarding/me/name', { name });
      // The access token's subject is the member name, so the tokens we hold went stale the
      // instant the rename landed. Store the new pair before anything else calls the API.
      await Promise.all([setAccessToken(res.accessToken), setRefreshToken(res.refreshToken)]);
      setCurrentUser(res.user);
      setStep('household');
    } catch (err: unknown) {
      setError(getUserMessage(err, t('createHousehold.errors.nameFailure')));
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

        {step === 'name' ? (
          <div className="mt-7 flex flex-1 flex-col">
            <h1 className="display-xl">{t('createHousehold.nameStep.heading')}</h1>
            <p className="mt-3 text-base text-muted-foreground">{t('createHousehold.nameStep.subtitle')}</p>

            <div className="mt-6">
              <Field
                label={t('createHousehold.nameStep.label')}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('createHousehold.nameStep.placeholder')}
                autoComplete="name"
                maxLength={40}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') void handleConfirmName(); }}
              />
            </div>

            {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

            <button
              type="button"
              onClick={() => void handleConfirmName()}
              disabled={loading || !displayName.trim()}
              className="btn-pine mt-4 w-full font-bold disabled:opacity-60"
            >
              {loading ? t('auth.pleaseWait') : t('createHousehold.nameStep.continue')}
            </button>
          </div>
        ) : (
        <>
        <h1 className="mt-7 display-xl">
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
                mode === m ? 'bg-ink text-ink-foreground' : 'text-muted-foreground'
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
                  {rooms.map((room, roomIndex) => {
                    const RoomIcon = ROOM_TYPE_ICONS[room.iconKey] ?? DEFAULT_ROOM_ICON;
                    return (
                    <div key={room.id} className="field flex items-center gap-3">
                      {/* Cycled by position so a list of rooms reads as a set of distinct places
                          rather than a column of identical grey tiles. */}
                      <span className={`tone-tile grid h-11 w-11 shrink-0 place-items-center rounded-[--r-sm] ${toneClass(toneByIndex(roomIndex))}`}>
                        <RoomIcon className="h-5 w-5" />
                      </span>
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
                            type="text"
                            inputMode="numeric"
                            value={room.minutes}
                            onChange={(e) => updateRoom(room.id, { minutes: e.target.value.replace(/\D/g, '').slice(0, 3) })}
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
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                        aria-label={t('createHousehold.removeRoom')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    );
                  })}

                  {suggestions.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('createHousehold.roomExamplesLabel')}</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((s) => {
                          const SuggestionIcon = ROOM_TYPE_ICONS[s.key] ?? DEFAULT_ROOM_ICON;
                          // Keyed rather than indexed so a room keeps its colour as the list filters.
                          return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => addSuggested(s)}
                            className={`tone-tile inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold ${toneClass(toneByKey(s.key))}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <SuggestionIcon className="h-4 w-4" />
                            {t(`createHousehold.defaultRooms.${s.key}`)}
                          </button>
                          );
                        })}
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
        </>
        )}

        <button type="button" onClick={goBackToAuth} className="mt-auto pt-8 pb-2 text-center text-sm font-bold text-muted-foreground">
          {t('createHousehold.backToAuth')}
        </button>
      </motion.div>
      {/* The tour spotlights elements that only exist on the household step. */}
      {step === 'household' && mode === 'create' && (
        <TourOverlay steps={ONBOARDING_TOUR_STEPS} storageKey="kollekt_onboarding_tour_v2" />
      )}
    </div>
  );
}
