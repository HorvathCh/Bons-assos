-- Subscribers choose their own level: follower or active member, with no validation.
-- Only the committee level is given by a leader, from the member list.
-- Safe to run again.

-- Requests that were waiting for validation are simply accepted.
update public.memberships
set status = 'active'
where status = 'pending';

-- Alone, a user can join as follower or active member...
drop policy if exists "memberships: self insert" on public.memberships;
create policy "memberships: self insert" on public.memberships
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role in ('follower', 'member')
    and status = 'active'
  );

-- ...and switch between the two (a committee member doing so leaves the committee).
drop policy if exists "memberships: self update" on public.memberships;
create policy "memberships: self update" on public.memberships
  for update to authenticated
  using (user_id = (select auth.uid()) and role <> 'leader')
  with check (
    user_id = (select auth.uid())
    and role in ('follower', 'member')
    and status = 'active'
  );
