drop index if exists uq_members_name;
create unique index uq_members_name_collective on members (name, collective_code);
