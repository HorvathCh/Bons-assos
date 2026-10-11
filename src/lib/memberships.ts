import { supabase } from './supabase';

export type MembershipRole = 'follower' | 'member' | 'committee' | 'leader';
export type MembershipStatus = 'pending' | 'active';

export type Membership = {
  association_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  /** Membership dues paid; set by a leader. */
  dues_up_to_date: boolean;
  /** Set by a leader, for active and committee members. */
  is_team_manager: boolean;
};

export type Association = { id: string; name: string; description: string };

/** An association with the public information of its page. */
export type AssociationDetails = Association & {
  president_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  hq_address: string | null;
  employee_count: number | null;
  /** Day the association was founded, as "YYYY-MM-DD". */
  founded_on: string | null;
};

export const ASSOCIATION_DETAILS_COLUMNS =
  'id, name, description, president_name, contact_email, contact_phone, hq_address, employee_count, founded_on';

// Calendar days are read and written in local time, so that they never shift by a day.
export function dayFromIso(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

export function dayToIso(day: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

const LONG_DAY = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "12 mars 1998" */
export const formatLongDay = (day: string) => LONG_DAY.format(dayFromIso(day));

export const ROLE_LABELS: Record<MembershipRole, string> = {
  follower: 'Abonné',
  member: 'Membre actif',
  committee: 'Membre du comité',
  leader: 'Responsable',
};

export function membershipLabel(membership: Pick<Membership, 'role' | 'status'>) {
  return membership.status === 'pending'
    ? 'Adhésion en attente de validation'
    : ROLE_LABELS[membership.role];
}

/**
 * Sets the caller's own level in an association. Users choose freely between follower and
 * active member; the database only lets leaders give the committee level.
 */
export function setOwnLevel(associationId: string, userId: string, role: 'follower' | 'member') {
  return supabase
    .from('memberships')
    .upsert(
      { association_id: associationId, user_id: userId, role, status: 'active' },
      { onConflict: 'association_id,user_id' }
    );
}

/** Removes someone from the association entirely: oneself, or a member when called by a leader. */
export function deleteMembership(associationId: string, userId: string) {
  return supabase
    .from('memberships')
    .delete()
    .eq('association_id', associationId)
    .eq('user_id', userId);
}

/** What a leader can change on a member. */
export type MemberChanges = {
  role?: Exclude<MembershipRole, 'leader'>;
  dues_up_to_date?: boolean;
  is_team_manager?: boolean;
};

/** Leader action on someone else's membership. */
export function updateMember(associationId: string, userId: string, changes: MemberChanges) {
  return supabase
    .from('memberships')
    .update(changes)
    .eq('association_id', associationId)
    .eq('user_id', userId);
}

/** The levels a leader can give, lowest first. Leaders themselves are named by the platform admin. */
export const LEVELS = (['follower', 'member', 'committee'] as const).map((role) => ({
  role,
  label: ROLE_LABELS[role],
}));

/** What a user can choose alone. */
export const OWN_LEVELS = LEVELS.filter((level) => level.role !== 'committee') as {
  role: 'follower' | 'member';
  label: string;
}[];

export const MEMBERSHIP_COLUMNS =
  'association_id, user_id, role, status, dues_up_to_date, is_team_manager';
