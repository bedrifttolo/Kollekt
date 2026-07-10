import { useMemo, useState } from 'react';
import { ArrowLeft, Dice5 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const claims = ['21', '66', '55', '44', '33', '22', '65', '64', '63', '62', '61', '54', '53', '52', '51', '43', '42', '41', '32', '31'];

function score(dice: number[]): string {
  const [high, low] = [...dice].sort((a, b) => b - a);
  return `${high}${low}`;
}

export default function MexicanGame({ players, onClose }: { players: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [turn, setTurn] = useState(0);
  const [dice, setDice] = useState<number[] | null>(null);
  const [claim, setClaim] = useState('21');
  const [previous, setPrevious] = useState<{ player: string; claim: string; actual: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const player = players[turn % players.length];
  const options = useMemo(() => previous ? claims.slice(0, Math.max(1, claims.indexOf(previous.claim))) : claims, [previous]);

  const roll = () => {
    const next = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    setDice(next);
    setClaim(options[options.length - 1] ?? '21');
    setResult(null);
  };

  const pass = () => {
    if (!dice) return;
    setPrevious({ player, claim, actual: score(dice) });
    setTurn((value) => value + 1);
    setDice(null);
  };

  const challenge = () => {
    if (!previous) return;
    const lied = claims.indexOf(previous.actual) > claims.indexOf(previous.claim);
    setResult(t(lied ? 'social.games.mexican.lieResult' : 'social.games.mexican.truthResult', { previous: previous.player, challenger: player, roll: previous.actual }));
    setPrevious(null);
    setDice(null);
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background p-5">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center gap-3"><button onClick={onClose} className="btn-ghost !p-3"><ArrowLeft className="h-5 w-5" /></button><div><p className="eyebrow">{t('social.games.catalog.mexican')}</p><h2 className="font-display text-2xl font-extrabold">{player}</h2></div></div>
        <div className="card text-sm leading-relaxed"><p className="font-bold">{t('social.games.rules')}</p><p className="mt-2 text-muted-foreground">{t('social.games.mexican.rules')}</p></div>
        {previous && <div className="card text-center"><p className="text-sm text-muted-foreground">{t('social.games.mexican.previousClaim', { player: previous.player })}</p><p className="mt-1 font-display text-4xl font-extrabold">{previous.claim}</p></div>}
        {result && <div className="card border-primary/30 text-center font-bold">{result}</div>}
        {dice ? (
          <div className="card space-y-5 text-center"><p className="text-sm text-muted-foreground">{t('social.games.mexican.privateRoll')}</p><div className="flex justify-center gap-4">{dice.map((value, index) => <span key={index} className="grid h-24 w-24 place-items-center rounded-3xl bg-primary text-5xl font-black text-primary-foreground">{value}</span>)}</div><label className="block text-left text-sm font-bold">{t('social.games.mexican.announce')}<select className="field mt-2 w-full" value={claim} onChange={(event) => setClaim(event.target.value)}>{options.map((value) => <option key={value}>{value}</option>)}</select></label><button onClick={pass} className="btn-lemon w-full">{t('social.games.mexican.hideAndPass')}</button></div>
        ) : (
          <div className="space-y-3">{previous && <button onClick={challenge} className="btn-ghost w-full">{t('social.games.mexican.challenge')}</button>}<button onClick={roll} className="btn-pine w-full"><Dice5 className="h-5 w-5" />{t('social.games.mexican.roll')}</button></div>
        )}
      </div>
    </div>
  );
}
