-- Every member of a collective should render with a distinct avatar color. Members without
-- an explicit color previously fell back to a client-side name hash with no cross-member
-- collision check, so two roommates could (and did) end up with the same color. This backfills
-- a unique color per member within each collective, keeping any already-unique explicit color
-- and only reassigning nulls/duplicates. Palette mirrors MemberColors.kt / memberColors.ts.
DO $$
DECLARE
  palette TEXT[] := ARRAY['#1f563f','#b84d6d','#7fa7c9','#d99a2b','#356d53','#e07a5f','#6b6bb8','#3f8a8a','#9c5fb8','#c98a3d'];
  collective_row RECORD;
  member_row RECORD;
  used TEXT[];
  chosen TEXT;
  i INT;
BEGIN
  FOR collective_row IN SELECT DISTINCT collective_code FROM members WHERE collective_code IS NOT NULL LOOP
    used := ARRAY[]::TEXT[];
    FOR member_row IN
      SELECT id, color FROM members WHERE collective_code = collective_row.collective_code ORDER BY id
    LOOP
      IF member_row.color IS NOT NULL AND lower(member_row.color) <> ALL (used) THEN
        used := array_append(used, lower(member_row.color));
      ELSE
        chosen := NULL;
        FOR i IN 1..array_length(palette, 1) LOOP
          IF lower(palette[i]) <> ALL (used) THEN
            chosen := palette[i];
            EXIT;
          END IF;
        END LOOP;
        IF chosen IS NULL THEN
          chosen := palette[1 + (array_length(used, 1) % array_length(palette, 1))];
        END IF;
        UPDATE members SET color = chosen WHERE id = member_row.id;
        used := array_append(used, lower(chosen));
      END IF;
    END LOOP;
  END LOOP;
END $$;
