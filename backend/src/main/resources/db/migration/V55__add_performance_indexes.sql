-- Indexes for the read paths used by the mobile application's main screens.
-- PostgreSQL does not automatically index foreign-key columns, so include those
-- explicitly where the application joins or filters on them.
CREATE INDEX IF NOT EXISTS idx_members_collective_code
    ON members (collective_code);

CREATE INDEX IF NOT EXISTS idx_tasks_collective_due_date
    ON tasks (collective_code, due_date, id);

CREATE INDEX IF NOT EXISTS idx_task_feedback_task_id
    ON task_feedback (task_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_events_collective_date
    ON events (collective_code, date, time, id);

CREATE INDEX IF NOT EXISTS idx_expenses_collective_date
    ON expenses (collective_code, date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_expense_participants_expense_id
    ON expense_participants (expense_id);

CREATE INDEX IF NOT EXISTS idx_settlement_checkpoints_collective_member
    ON settlement_checkpoints (collective_code, settled_by, id DESC);

CREATE INDEX IF NOT EXISTS idx_personal_settlements_collective_pair
    ON personal_settlements (collective_code, paid_by, paid_to);

CREATE INDEX IF NOT EXISTS idx_pant_entries_collective_date
    ON pant_entries (collective_code, date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_shopping_items_collective_completed
    ON shopping_items (collective_code, completed, id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_household_recent
    ON chat_messages (collective_code, timestamp DESC, id DESC)
    WHERE recipient IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_direct_recent
    ON chat_messages (collective_code, sender, recipient, timestamp DESC, id DESC)
    WHERE recipient IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
    ON notifications (user_name, timestamp DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_invitations_email
    ON invitations (email);

CREATE INDEX IF NOT EXISTS idx_invitations_collective_code
    ON invitations (collective_code);

CREATE INDEX IF NOT EXISTS idx_maintenance_history_ticket_changed
    ON maintenance_ticket_status_history (ticket_id, changed_at, id);
