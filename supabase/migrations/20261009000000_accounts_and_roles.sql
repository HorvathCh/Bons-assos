-- Accounts and association roles.
--
-- Roles, per association (one row per user and association in `memberships`):
--   follower  : free subscription to the association news feed
--   member    : active member; self-declared (status 'pending') then validated by a leader
--   committee : active member appointed by a leader
--   leader    : invited by a platform admin (see the `invite-leader` edge function)
--
-- Safe to run again, and on a project that already has a `profiles` table.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists full_name text default '';

-- Kept apart from `profiles` so that no profile update can ever grant admin rights.
-- Rows are only added by hand, from the SQL editor.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.associations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  description text not null default '',
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regtype('public.membership_role') is null then
    create type public.membership_role as enum ('follower', 'member', 'committee', 'leader');
  end if;
  if to_regtype('public.membership_status') is null then
    create type public.membership_status as enum ('pending', 'active');
  end if;
end $$;

create table if not exists public.memberships (
  association_id uuid not null references public.associations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.membership_role not null default 'follower',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  validated_by uuid references public.profiles (id) on delete set null,
  validated_at timestamptz,
  primary key (association_id, user_id),
  -- 'pending' only exists for a self-declared member awaiting validation
  constraint pending_only_for_member check (status = 'active' or role = 'member')
);

create index if not exists memberships_user_id_idx on public.memberships (user_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer: they read tables protected by RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

create or replace function public.has_association_role(
  p_association_id uuid,
  p_roles public.membership_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    where association_id = p_association_id
      and user_id = (select auth.uid())
      and status = 'active'
      and role = any (p_roles)
  );
$$;

-- Used by the `invite-leader` edge function only.
create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- Lets a signed-in user delete their own account (cascades to profile and memberships).
create or replace function public.delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.profiles where id = (select auth.uid());
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.has_association_role(uuid, public.membership_role[]) from public, anon;
revoke execute on function public.user_id_by_email(text) from public, anon, authenticated;
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.has_association_role(uuid, public.membership_role[]) to authenticated, service_role;
grant execute on function public.user_id_by_email(text) to service_role;
grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- A profile for every new account.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

-- Keeps (association, user) immutable and records who validated a role.
-- Calls without a user (service role) keep the values they provide.
create or replace function public.memberships_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  changed boolean := true;
begin
  if tg_op = 'UPDATE' then
    if new.association_id <> old.association_id or new.user_id <> old.user_id then
      raise exception 'association_id and user_id cannot be changed';
    end if;
    changed := new.role <> old.role or new.status <> old.status;
  end if;

  if (select auth.uid()) is not null then
    if not changed then
      new.validated_by := old.validated_by;
      new.validated_at := old.validated_at;
    elsif new.status = 'active' and new.role <> 'follower' then
      new.validated_by := (select auth.uid());
      new.validated_at := now();
    else
      new.validated_by := null;
      new.validated_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_before_write on public.memberships;
create trigger memberships_before_write
  before insert or update on public.memberships
  for each row execute function public.memberships_before_write();

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.platform_admins, public.associations, public.memberships
  from anon, authenticated;

grant select on public.associations to anon, authenticated;
grant insert, update, delete on public.associations to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant all on public.profiles, public.platform_admins, public.associations, public.memberships
  to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security; -- no policy: not reachable from the app
alter table public.associations enable row level security;
alter table public.memberships enable row level security;

-- profiles: names are visible to signed-in users, each user edits their own.
drop policy if exists "profiles: read" on public.profiles;
create policy "profiles: read" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- associations: public directory, edited by their leaders, created by platform admins.
drop policy if exists "associations: read" on public.associations;
create policy "associations: read" on public.associations
  for select to anon, authenticated using (true);

drop policy if exists "associations: leader update" on public.associations;
create policy "associations: leader update" on public.associations
  for update to authenticated
  using (public.has_association_role(id, '{leader}'))
  with check (public.has_association_role(id, '{leader}'));

drop policy if exists "associations: admin all" on public.associations;
create policy "associations: admin all" on public.associations
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- memberships: read
drop policy if exists "memberships: read own" on public.memberships;
create policy "memberships: read own" on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "memberships: leader and committee read" on public.memberships;
create policy "memberships: leader and committee read" on public.memberships
  for select to authenticated
  using (public.has_association_role(association_id, '{leader,committee}'));

-- memberships: what a user may do alone.
-- Follow freely, or declare themselves active member (pending until validated).
drop policy if exists "memberships: self insert" on public.memberships;
create policy "memberships: self insert" on public.memberships
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (role = 'follower' and status = 'active')
      or (role = 'member' and status = 'pending')
    )
  );

-- Request membership, cancel the request, or step down to follower. Never upwards.
drop policy if exists "memberships: self update" on public.memberships;
create policy "memberships: self update" on public.memberships
  for update to authenticated
  using (user_id = (select auth.uid()) and role <> 'leader')
  with check (
    user_id = (select auth.uid())
    and (
      (role = 'follower' and status = 'active')
      or (role = 'member' and status = 'pending')
    )
  );

-- Unfollow / leave.
drop policy if exists "memberships: self delete" on public.memberships;
create policy "memberships: self delete" on public.memberships
  for delete to authenticated
  using (user_id = (select auth.uid()) and role <> 'leader');

-- memberships: what a leader may do in their association.
-- Validate or refuse a request, appoint or dismiss a committee member, remove a member
-- (back to follower). Leader rows are out of reach: only platform admins manage leaders.
drop policy if exists "memberships: leader update" on public.memberships;
create policy "memberships: leader update" on public.memberships
  for update to authenticated
  using (public.has_association_role(association_id, '{leader}') and role <> 'leader')
  with check (
    public.has_association_role(association_id, '{leader}')
    and role <> 'leader'
    and status = 'active'
  );

drop policy if exists "memberships: admin all" on public.memberships;
create policy "memberships: admin all" on public.memberships
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
