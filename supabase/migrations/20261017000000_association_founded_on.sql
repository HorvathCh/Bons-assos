-- Date the association was created (founded), shown on its page.
-- Safe to run again.

alter table public.associations add column if not exists founded_on date;
