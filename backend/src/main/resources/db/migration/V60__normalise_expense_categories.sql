-- Expense category has always been a free-text varchar with no constraint, while the UI offered a
-- fixed list of six. Two backend paths wrote values outside that list: ShoppingOperations wrote
-- "SUPPLIES" (which rendered as a raw, untranslated string in the app) and older rows may hold
-- anything at all. That is tolerable for a flat list, but not for a spending breakdown, where every
-- stray spelling becomes its own slice of the chart.
--
-- Fold everything onto the canonical six, case-insensitively, then constrain the column so it
-- cannot drift again. EconomyOperations validates the same set on write.

update expenses set category = 'Groceries' where upper(trim(category)) in ('SUPPLIES', 'GROCERIES');
update expenses set category = 'Bills' where upper(trim(category)) = 'BILLS';
update expenses set category = 'Cleaning' where upper(trim(category)) = 'CLEANING';
update expenses set category = 'Entertainment' where upper(trim(category)) = 'ENTERTAINMENT';
update expenses set category = 'Food' where upper(trim(category)) = 'FOOD';

-- Anything still unrecognised (legacy free text) becomes Other rather than being dropped, so no
-- expense loses its amount or its participants.
update expenses
set category = 'Other'
where category not in ('Groceries', 'Bills', 'Cleaning', 'Entertainment', 'Food', 'Other');

-- Added NOT VALID first, then validated in a second statement. Adding a validated CHECK in one
-- step holds ACCESS EXCLUSIVE while it scans every row; NOT VALID takes that lock only briefly and
-- VALIDATE then runs under the weaker SHARE UPDATE EXCLUSIVE. V57–V59 had to be split apart after
-- hitting Supabase's statement timeout, so this migration avoids the same shape.
alter table expenses
    add constraint expenses_category_check
        check (category in ('Groceries', 'Bills', 'Cleaning', 'Entertainment', 'Food', 'Other'))
        not valid;

alter table expenses validate constraint expenses_category_check;

-- expenses already has row level security enabled (V57); no new table is created here.
