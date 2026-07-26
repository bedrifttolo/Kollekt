-- Lock down remaining tables against Supabase's PostgREST API (batch 2 of 3).
alter table achievements enable row level security;
alter table events enable row level security;
alter table invitations enable row level security;
alter table pant_entries enable row level security;
alter table settlement_checkpoints enable row level security;
alter table expense_participants enable row level security;
alter table rooms enable row level security;
alter table collectives enable row level security;
alter table notifications enable row level security;
alter table shopping_items enable row level security;
alter table task_feedback enable row level security;
alter table collective_enabled_achievements enable row level security;
