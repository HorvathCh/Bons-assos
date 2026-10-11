-- Each event is addressed to a group: everybody, the active members of the association,
-- or its committee only. The group decides who can see the event.
-- Safe to run again.

alter table public.events
  add column if not exists audience text not null default 'everyone'
  check (audience in ('everyone', 'members', 'committee'));

drop policy if exists "events: read" on public.events;

drop policy if exists "events: read public" on public.events;
create policy "events: read public" on public.events
  for select to anon, authenticated
  using (audience = 'everyone');

-- Leaders are part of both groups; platform admins see everything.
drop policy if exists "events: read invited" on public.events;
create policy "events: read invited" on public.events
  for select to authenticated
  using (
    (audience = 'members'
      and public.has_association_role(association_id, '{member,committee,leader}'))
    or (audience = 'committee'
      and public.has_association_role(association_id, '{committee,leader}'))
    or public.is_platform_admin()
  );
