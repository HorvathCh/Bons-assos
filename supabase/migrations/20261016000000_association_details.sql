-- Public information shown on an association's page. Filled in by its leaders
-- (and platform admins), who already have the right to update the association.
-- Safe to run again.

alter table public.associations
  add column if not exists president_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists hq_address text,
  add column if not exists employee_count integer check (employee_count >= 0);
