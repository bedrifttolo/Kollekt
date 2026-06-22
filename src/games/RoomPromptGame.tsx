import { useEffect, useState } from 'react';
import { Check, Clipboard, Copy, Plus, Sparkles, Trash2, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import type { PartyGameRoom } from '../lib/types';

const CATEGORIES = [
  'HOT_TAKES',
  'PLOT_TWISTS',
  'TINY_CONFESSIONS',
  'FUTURE_HEADLINES',
  'HOUSE_AWARDS',
  'IMPOSSIBLE_CHOICES',
  'FRIENDLY_CHALLENGES',
  'WILDCARD',
  'PEKELEK',
  'JEG_HAR_ALDRI',
  'RED_FLAG_DEALBREAKER_OK',
  'FUCK_MARRY_KILL',
  'LAG_EN_REGEL',
  'DILEMMA',
  'KATEGORILEK',
] as const;

export default function RoomPromptGame({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const [room, setRoom] = useState<PartyGameRoom | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('HOT_TAKES');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const name = currentUser?.name ?? '';
  const me = room?.participants.find((participant) => participant.name === name);
  const isHost = room?.hostName === name;
  const everyoneReady = (room?.participants.length ?? 0) >= 2 && room?.participants.every((participant) => participant.ready);
  const currentQuestion = room?.questions[room.currentQuestionIndex] ?? null;

  useEffect(() => {
    if (!room?.code) return;
    const timer = window.setInterval(() => {
      api.get<PartyGameRoom>(`/party-game/rooms/${room.code}`)
        .then(setRoom)
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [room?.code]);

  const run = async (request: () => Promise<PartyGameRoom>) => {
    setError('');
    try {
      setRoom(await request());
      return true;
    } catch {
      setError(t('social.games.promptRelay.genericError'));
      return false;
    }
  };

  const createRoom = () => run(() => api.post<PartyGameRoom>('/party-game/rooms', {}));
  const joinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) return;
    void run(() => api.post<PartyGameRoom>('/party-game/rooms/join', { roomCode: code }));
  };
  const addQuestion = async () => {
    if (!room || !prompt.trim()) return;
    if (await run(() => api.post<PartyGameRoom>(`/party-game/rooms/${room.code}/questions`, { prompt, category }))) {
      setPrompt('');
    }
  };

  if (!room) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background safe-top safe-bottom">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="eyebrow">{t('social.games.promptRelay.eyebrow')}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold">{t('social.games.catalog.promptRelay')}</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card" aria-label={t('common.cancel')}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-4 px-5">
          <div className="househero">
            <Sparkles className="h-8 w-8 text-secondary" />
            <h3 className="mt-3 font-display text-3xl font-extrabold">{t('social.games.promptRelay.createTitle')}</h3>
            <p className="mt-2 text-sm text-white/75">{t('social.games.promptRelay.createDescription')}</p>
            <button onClick={createRoom} className="btn-lemon mt-5 w-full">{t('social.games.promptRelay.createRoom')}</button>
          </div>
          <div className="card">
            <h3 className="font-display text-xl font-bold">{t('social.games.promptRelay.joinTitle')}</h3>
            <div className="mt-3 flex gap-2">
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                onKeyDown={(event) => event.key === 'Enter' && joinRoom()}
                placeholder={t('social.games.promptRelay.roomCode')}
                className="field !min-h-0 min-w-0 flex-1 py-3 text-center font-display text-lg font-bold uppercase tracking-[.2em]"
              />
              <button onClick={joinRoom} disabled={roomCode.length !== 6} className="btn-pine px-5 disabled:opacity-50">{t('social.games.promptRelay.join')}</button>
            </div>
          </div>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background safe-top safe-bottom">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-extrabold">{t('social.games.catalog.promptRelay')}</h2>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(room.code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold tracking-[.12em] text-primary"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{room.code}
          </button>
        </div>
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card" aria-label={t('common.cancel')}><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {room.status === 'LOBBY' && (
          <div className="space-y-5">
            <section className="card">
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="font-display text-lg font-bold">{t('social.games.promptRelay.players')}</h3></div>
              <div className="mt-3 space-y-2">
                {room.participants.map((participant) => (
                  <div key={participant.name} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-bold text-primary-foreground">{participant.name[0]?.toUpperCase()}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{participant.name}{participant.name === room.hostName ? ` · ${t('social.games.promptRelay.host')}` : ''}</p><p className="text-[10px] text-muted-foreground">{t('social.games.promptRelay.questionCount', { count: participant.questionCount })}</p></div>
                    <span className={`pill ${participant.ready ? 'pill-pine' : 'pill-lemon'}`}>{t(participant.ready ? 'social.games.promptRelay.done' : 'social.games.promptRelay.writing')}</span>
                  </div>
                ))}
              </div>
            </section>

            {!me?.ready && (
              <section>
                <h3 className="font-display text-xl font-bold">{t('social.games.promptRelay.writeTitle')}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t('social.games.promptRelay.writeHint')}</p>
                <div className="mt-3 rounded-3xl border border-border bg-card p-3">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{t('social.games.promptRelay.categoryLabel')}</span>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}
                      className="field mt-2 min-h-0 w-full py-3 text-sm font-bold"
                    >
                      {CATEGORIES.map((value) => (
                        <option key={value} value={value}>{t(`social.games.promptRelay.categories.${value}.title`)}</option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-3 rounded-2xl bg-muted/40 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{t('social.games.promptRelay.selectedCategory')}</p>
                    <p className="mt-1 text-sm font-bold">{t(`social.games.promptRelay.categories.${category}.title`)}</p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{t(`social.games.promptRelay.categories.${category}.example`)}</p>
                  </div>
                </div>
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value.slice(0, 300))} placeholder={t(`social.games.promptRelay.categories.${category}.placeholder`)} className="field mt-3 min-h-28 w-full resize-none text-sm" />
                <button onClick={() => void addQuestion()} disabled={!prompt.trim()} className="btn-pine mt-2 w-full disabled:opacity-50"><Plus className="h-4 w-4" />{t('social.games.promptRelay.addQuestion')}</button>
              </section>
            )}

            {room.myQuestions.length > 0 && (
              <section>
                <h3 className="font-display text-lg font-bold">{t('social.games.promptRelay.yourQuestions')}</h3>
                <div className="mt-2 space-y-2">
                  {room.myQuestions.map((question) => (
                    <div key={question.id} className="card !rounded-2xl !p-3 flex items-center gap-3"><Clipboard className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{t(`social.games.promptRelay.categories.${question.category}.title`)}</p><p className="text-sm">{question.prompt}</p></div>{!me?.ready && <button onClick={() => void run(() => api.delete<PartyGameRoom>(`/party-game/rooms/${room.code}/questions/${question.id}`))} aria-label={t('common.cancel')}><Trash2 className="h-4 w-4 shrink-0 text-destructive" /></button>}</div>
                  ))}
                </div>
              </section>
            )}

            <button onClick={() => void run(() => api.patch<PartyGameRoom>(`/party-game/rooms/${room.code}/ready`, { ready: !me?.ready }))} disabled={!me?.ready && room.myQuestions.length === 0} className="btn-ghost w-full disabled:opacity-50">{t(me?.ready ? 'social.games.promptRelay.keepWriting' : 'social.games.promptRelay.doneWriting')}</button>
            {isHost ? (
              <button onClick={() => void run(() => api.post<PartyGameRoom>(`/party-game/rooms/${room.code}/start`, {}))} disabled={!everyoneReady} className="btn-lemon w-full disabled:opacity-50">{t('social.games.promptRelay.start')}</button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">{t('social.games.promptRelay.waitingForHost')}</p>
            )}
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
          </div>
        )}

        {room.status === 'PLAYING' && currentQuestion && (
          <div className="flex min-h-full flex-col justify-center gap-5">
            <div className="text-center text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{t('social.games.promptRelay.progress', { current: room.currentQuestionIndex + 1, total: room.questions.length })}</div>
            <div className="househero min-h-72 flex flex-col justify-between">
              <p className="eyebrow !text-white/70">{t(`social.games.promptRelay.categories.${currentQuestion.category}.title`)}</p>
              <p className="font-display text-3xl font-extrabold leading-snug">{currentQuestion.prompt}</p>
              <p className="text-sm text-white/65">{t('social.games.promptRelay.readAloud')}</p>
            </div>
            {isHost ? <button onClick={() => void run(() => api.post<PartyGameRoom>(`/party-game/rooms/${room.code}/next`, {}))} className="btn-lemon w-full">{t('social.games.promptRelay.next')}</button> : <p className="text-center text-sm text-muted-foreground">{t('social.games.promptRelay.hostAdvances')}</p>}
          </div>
        )}

        {room.status === 'FINISHED' && (
          <div className="flex min-h-full flex-col items-center justify-center text-center"><Sparkles className="h-12 w-12 text-secondary" /><h3 className="mt-3 font-display text-3xl font-extrabold">{t('social.games.promptRelay.finished')}</h3><p className="mt-2 text-sm text-muted-foreground">{t('social.games.promptRelay.finishedHint')}</p><button onClick={onClose} className="btn-pine mt-6 w-full">{t('social.games.promptRelay.backToGames')}</button></div>
        )}
      </div>
    </div>
  );
}
