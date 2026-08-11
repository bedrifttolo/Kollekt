alter table chat_messages add column edited boolean not null default false;
alter table chat_messages add column deleted boolean not null default false;
