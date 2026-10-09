-- Events belong to an association. Everyone can read them; they are created and managed
-- by the leaders and committee members of the association (and platform admins).
--
-- Builds on the existing `events` table (title, description, location, starts_at,
-- ends_at, created_by). Safe to run again.

alter table public.events
  add column if not exists association_id uuid references public.associations (id) on delete cascade;

create index if not exists events_association_starts_at_idx
  on public.events (association_id, starts_at);

alter table public.events enable row level security;

-- Start from a clean slate: any earlier policy on this table could let users write
-- events outside the rules below.
do $$
declare
  existing record;
begin
  for existing in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'events'
  loop
    execute format('drop policy %I on public.events', existing.policyname);
  end loop;
end $$;

revoke all on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;

create policy "events: read" on public.events
  for select to anon, authenticated using (true);

create policy "events: organisers insert" on public.events
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      public.has_association_role(association_id, '{leader,committee}')
      or public.is_platform_admin()
    )
  );

create policy "events: organisers update" on public.events
  for update to authenticated
  using (
    public.has_association_role(association_id, '{leader,committee}')
    or public.is_platform_admin()
  )
  with check (
    association_id is not null
    and (
      public.has_association_role(association_id, '{leader,committee}')
      or public.is_platform_admin()
    )
  );

create policy "events: organisers delete" on public.events
  for delete to authenticated
  using (
    public.has_association_role(association_id, '{leader,committee}')
    or public.is_platform_admin()
  );
