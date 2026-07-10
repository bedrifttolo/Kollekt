import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Eye, RotateCcw, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const promptKeys = ['vacuum', 'penguin', 'superhero', 'pizza', 'washingMachine', 'cat', 'football', 'alarmClock', 'hairdresser', 'airplane', 'ghost', 'chef', 'robot', 'fishing', 'selfie', 'banana', 'snowman', 'guitar', 'trafficJam', 'movingDay'];

export default function CharadesGame({ players, onClose }: { players: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  const deck = useMemo(() => [...promptKeys].sort(() => Math.random() - 0.5), []);
  const [turn, setTurn] = useState(0);
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(60);
  const [playing, setPlaying] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>(() => Object.fromEntries(players.map((player) => [player, 0])));
  const player = players[turn % players.length];

  useEffect(() => {
    if (!playing || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [playing, seconds]);

  const nextPrompt = (point: boolean) => {
    if (point) setScores((value) => ({ ...value, [player]: value[player] + 1 }));
    setIndex((value) => (value + 1) % deck.length);
  };
  const nextPlayer = () => { setPlaying(false); setSeconds(60); setTurn((value) => value + 1); setIndex((value) => (value + 1) % deck.length); };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background p-5"><div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center gap-3"><button onClick={onClose} className="btn-ghost !p-3"><ArrowLeft className="h-5 w-5" /></button><div><p className="eyebrow">{t('social.games.catalog.charades')}</p><h2 className="font-display text-2xl font-extrabold">{t('social.games.charadesGame.turn', { player })}</h2></div></div>
      <div className="flex flex-wrap gap-2">{players.map((name) => <span key={name} className="pill pill-pine">{name}: {scores[name]}</span>)}</div>
      <div className="card flex min-h-80 flex-col items-center justify-center text-center">
        {!playing ? <><Eye className="h-10 w-10 text-primary" /><p className="mt-4 text-sm text-muted-foreground">{t('social.games.charadesGame.passPhone', { player })}</p><button onClick={() => setPlaying(true)} className="btn-lemon mt-6">{t('social.games.charadesGame.show')}</button></> : <><div className={`font-display text-5xl font-black ${seconds <= 10 ? 'text-destructive' : 'text-primary'}`}>{seconds}</div><h3 className="mt-8 font-display text-3xl font-extrabold">{t(`social.games.charadesGame.prompts.${deck[index]}`)}</h3><p className="mt-3 text-sm text-muted-foreground">{t('social.games.charadesGame.noWords')}</p></>}
      </div>
      {playing && seconds > 0 && <div className="grid grid-cols-2 gap-3"><button onClick={() => nextPrompt(false)} className="btn-ghost"><SkipForward className="h-4 w-4" />{t('social.games.charadesGame.skip')}</button><button onClick={() => nextPrompt(true)} className="btn-pine"><Check className="h-4 w-4" />{t('social.games.charadesGame.correct')}</button></div>}
      {playing && seconds === 0 && <button onClick={nextPlayer} className="btn-lemon w-full">{t('social.games.charadesGame.nextPlayer')}</button>}
      <button onClick={() => { setScores(Object.fromEntries(players.map((name) => [name, 0]))); setTurn(0); setSeconds(60); setPlaying(false); }} className="mx-auto flex items-center gap-2 text-xs text-muted-foreground"><RotateCcw className="h-3 w-3" />{t('social.games.restart')}</button>
    </div></div>
  );
}
