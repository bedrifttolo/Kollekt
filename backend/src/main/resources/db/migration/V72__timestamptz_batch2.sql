-- Second batch of the timezone-naive timestamp fix; see V70/V71 for rationale.
alter table house_checkins
    alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table checkin_responses
    alter column created_at type timestamptz using created_at at time zone 'UTC';

alter table house_rules
    alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table house_rule_ack
    alter column acknowledged_at type timestamptz using acknowledged_at at time zone 'UTC';

alter table guest_notices
    alter column created_at type timestamptz using created_at at time zone 'UTC';

alter table maintenance_ticket
    alter column created_at type timestamptz using created_at at time zone 'UTC';
alter table maintenance_ticket
    alter column updated_at type timestamptz using updated_at at time zone 'UTC';
alter table maintenance_ticket_status_history
    alter column changed_at type timestamptz using changed_at at time zone 'UTC';

alter table kudos
    alter column created_at type timestamptz using created_at at time zone 'UTC';

alter table task_history
    alter column completed_at type timestamptz using completed_at at time zone 'UTC';

alter table meeting_topics
    alter column created_at type timestamptz using created_at at time zone 'UTC';
