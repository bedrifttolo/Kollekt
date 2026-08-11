-- Repairs balances that the nightly missed-task penalty job drove below zero. TaskOperations
-- now floors XP at 0 on every write and recomputes level from the floored value, but rows
-- written before that fix still hold negative XP — and because Kotlin's Int division truncates
-- toward zero, they render as "Nv.-1" (-455 / 200 + 1 = -1) on the leaderboard, the member
-- sheet and the dashboard.
update members set xp = 0 where xp < 0;

-- Recompute level for anything the penalty paths left stale: they adjusted xp without touching
-- level at all, so a member's level could disagree with their balance in either direction.
-- Mirrors levelForXp(): floor(xp / XP_PER_LEVEL) + 1, with XP_PER_LEVEL = 200.
update members set level = xp / 200 + 1 where level <> xp / 200 + 1;
