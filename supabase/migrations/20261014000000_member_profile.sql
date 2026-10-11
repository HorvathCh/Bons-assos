-- Member profile, managed by the leaders of the association: membership dues, team manager,
-- and removal from the association.
-- Safe to run again.

alter table public.memberships
  add column if not exists dues_up_to_date boolean not null default false,
  add column if not exists is_team_manager boolean not null default false;

-- Replaces the earlier version of this trigger function. In addition to keeping
-- (association, user) immutable and recording who validated a role, it makes sure that
-- only leaders and platform admins decide on dues and team managers: users can edit
-- their own row, so these two columns must not follow what they send.
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

  -- Calls without a user (service role, SQL editor) keep the values they provide.
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

    if not (
      public.has_association_role(new.association_id, '{leader}')
      or public.is_platform_admin()
    ) then
      if tg_op = 'UPDATE' then
        new.dues_up_to_date := old.dues_up_to_date;
        new.is_team_manager := old.is_team_manager;
      else
        new.dues_up_to_date := false;
        new.is_team_manager := false;
      end if;
    end if;
  end if;

  -- A team manager is at least an active member.
  if new.role = 'follower' then
    new.is_team_manager := false;
  end if;

  return new;
end;
$$;

-- Leaders can remove someone from their association (never another leader).
drop policy if exists "memberships: leader delete" on public.memberships;
create policy "memberships: leader delete" on public.memberships
  for delete to authenticated
  using (public.has_association_role(association_id, '{leader}') and role <> 'leader');
