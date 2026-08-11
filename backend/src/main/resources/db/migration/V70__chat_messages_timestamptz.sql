-- Fixes chat message timestamps displaying in the wrong timezone: the column was a naive
-- `timestamp` with no offset, so Jackson serialized it without a `Z`/offset suffix and browsers
-- parsed it as local time instead of UTC. The server has always run in UTC, so existing values
-- are reinterpreted as UTC wall-clock time (not shifted) by tagging them with that zone.
alter table chat_messages
    alter column "timestamp" type timestamptz
    using "timestamp" at time zone 'UTC';
