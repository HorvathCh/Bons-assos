-- Recurring meetings are stored as one event per date; the events created together share
-- a series id, so that a whole series can be found again later.
-- Safe to run again.

alter table public.events add column if not exists series_id uuid;

create index if not exists events_series_id_idx on public.events (series_id);
