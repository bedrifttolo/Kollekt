-- Records which app build a device is running, so a future release can tell stale installs apart
-- without guessing. Nullable on purpose: clients older than the build that introduced this never
-- send it, so "null" reads as "older than the first version that reports its version".
alter table push_device_tokens add column app_version varchar(32);

-- Stamped when the one-shot "a new version is out" push has been sent to this device, so the
-- broadcast is idempotent and cannot re-fire on a device that already got it.
alter table push_device_tokens add column app_update_push_sent_at timestamptz;
