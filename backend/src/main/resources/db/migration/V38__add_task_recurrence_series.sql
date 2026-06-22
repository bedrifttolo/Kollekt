ALTER TABLE tasks
    ADD COLUMN recurrence_series_id VARCHAR(64),
    ADD COLUMN recurrence_anchor_date DATE;

UPDATE tasks
SET recurrence_series_id = md5(
    COALESCE(collective_code, '') || chr(31) || title || chr(31) || UPPER(recurrence_rule)
)
WHERE recurrence_rule IS NOT NULL
  AND TRIM(recurrence_rule) <> ''
  AND UPPER(recurrence_rule) <> 'NONE';

UPDATE tasks AS task
SET recurrence_anchor_date = series.anchor_date
FROM (
    SELECT recurrence_series_id, MIN(due_date) AS anchor_date
    FROM tasks
    WHERE recurrence_series_id IS NOT NULL
    GROUP BY recurrence_series_id
) AS series
WHERE task.recurrence_series_id = series.recurrence_series_id;

CREATE INDEX idx_tasks_recurrence_series_id
    ON tasks (recurrence_series_id);
