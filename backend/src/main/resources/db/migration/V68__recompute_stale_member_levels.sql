-- Repairs member levels that the nightly missed-task penalty job left behind. It adjusted xp
-- without ever recomputing level, so a member's level drifted out of sync with their balance until
-- their next completion happened to fix it — and where it *was* recomputed, Kotlin's Int division
-- truncates toward zero, so a negative balance produced a negative level ("Nv.-1" for -455 XP).
--
-- Deliberately does NOT touch xp itself. A negative balance is the intended consequence of missing
-- chores; only the level is floored, because a negative level is meaningless as a label while a
-- negative balance is the point of the penalty.
--
-- Mirrors levelForXp(): greatest(xp, 0) / XP_PER_LEVEL + 1, with XP_PER_LEVEL = 200.
update members
set level = greatest(xp, 0) / 200 + 1
where level <> greatest(xp, 0) / 200 + 1;
