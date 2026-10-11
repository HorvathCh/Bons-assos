-- Presence declaration: the organiser of an event decides whether the people invited must
-- say if they will attend; each of them then answers "present" or "absent".
-- Safe to run again.

alter table public.events
  add column if not exists requires_presence boolean not null default false;

create table if not exists public.event_attendances (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_attendances_user_id_idx on public.event_attendances (user_id);

revoke all on public.event_attendances from anon, authenticated;
grant select, insert, update, delete on public.event_attendances to authenticated;
grant all on public.event_attendances to service_role;

alter table public.event_attendances enable row level security;

-- Everyone sees their own answer.
drop policy if exists "attendances: read own" on public.event_attendances;
create policy "attendances: read own" on public.event_attendances
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The organisers of the event see all the answers.
drop policy if exists "attendances: organisers read" on public.event_attendances;
create policy "attendances: organisers read" on public.event_attendances
  for select to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_id
        and (
          public.has_association_role(e.association_id, '{leader,committee}')
          or public.is_platform_admin()
        )
    )
  );

-- A user answers for themselves, on an event that asks for it. The sub-query on `events`
-- runs with the user's own rights, so it only finds events they are allowed to see.
drop policy if exists "attendances: answer" on public.event_attendances;
create policy "attendances: answer" on public.event_attendances
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.requires_presence)
  );

drop policy if exists "attendances: change answer" on public.event_attendances;
create policy "attendances: change answer" on public.event_attendances
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.requires_presence)
  );

drop policy if exists "attendances: withdraw answer" on public.event_attendances;
create policy "attendances: withdraw answer" on public.event_attendances
  for delete to authenticated
  using (user_id = (select auth.uid()));
