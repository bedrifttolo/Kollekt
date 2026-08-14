import { useMemo, useState } from 'react';
import { Check, Plus, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../components/ui-kit';

interface PlayerSetupProps {
  gameTitle: string;
  householdMembers: string[];
  initialPlayers: string[];
  minPlayers: number;
  onClose: () => void;
  onStart: (players: string[]) => void;
}

export default function PlayerSetup({
  gameTitle,
  householdMembers,
  initialPlayers,
  minPlayers,
  onClose,
  onStart,
}: PlayerSetupProps) {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<string[]>(() =>
    initialPlayers.length > 0 ? initialPlayers : householdMembers,
  );
  const [guestName, setGuestName] = useState('');
  const householdNames = useMemo(
    () => new Set(householdMembers.map((member) => member.toLowerCase())),
    [householdMembers],
  );
  const guests = players.filter((player) => !householdNames.has(player.toLowerCase()));

  const toggleHouseholdMember = (member: string) => {
    setPlayers((current) =>
      current.includes(member)
        ? current.filter((player) => player !== member)
        : [...current, member],
    );
  };

  const addGuest = () => {
    const name = guestName.trim();
    if (!name || players.some((player) => player.toLowerCase() === name.toLowerCase())) return;
    setPlayers((current) => [...current, name]);
    setGuestName('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background safe-top safe-bottom">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">
            {t('social.games.setup.choosePlayers')}
          </p>
          <h2 className="font-display text-xl font-extrabold">{gameTitle}</h2>
        </div>
        <IconButton onClick={onClose} label={t('common.cancel')} icon={<X className="h-4 w-4" />} />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">{t('social.games.setup.household')}</h3>
            <span className="text-xs text-muted-foreground">{t('social.games.setup.selected', { count: players.length })}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {householdMembers.map((member) => {
              const selected = players.includes(member);
              return (
                <button
                  key={member}
                  onClick={() => toggleHouseholdMember(member)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${
                    selected ? 'border-primary/40 bg-primary/10' : 'border-border bg-card'
                  }`}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary font-bold text-primary-foreground">
                    {member[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{member}</span>
                  {selected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
          {householdMembers.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('social.games.setup.noMembers')}</p>
          )}
        </section>

        <section>
          <h3 className="font-display text-lg font-bold">{t('social.games.setup.guests')}</h3>
          <div className="mt-3 flex gap-2">
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addGuest()}
              placeholder={t('social.games.setup.guestPlaceholder')}
              className="field !min-h-0 flex-1 py-2.5 text-sm"
            />
            <button onClick={addGuest} className="btn-ghost shrink-0 px-4" aria-label={t('social.games.setup.addGuest')}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {guests.map((guest) => (
              <button
                key={guest}
                onClick={() => setPlayers((current) => current.filter((player) => player !== guest))}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium"
              >
                {guest}<X className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-border px-5 py-4">
        {players.length < minPlayers && (
          <p className="mb-2 text-center text-xs text-destructive">
            {t('social.games.setup.needPlayers', { count: minPlayers })}
          </p>
        )}
        <button
          onClick={() => onStart(players)}
          disabled={players.length < minPlayers}
          className="btn-lemon w-full disabled:opacity-50"
        >
          <Users className="h-5 w-5" />
          {t('social.games.setup.start', { count: players.length })}
        </button>
      </div>
    </div>
  );
}
