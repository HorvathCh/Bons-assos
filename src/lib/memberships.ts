import { supabase } from './supabase';

export type MembershipRole = 'follower' | 'member' | 'committee' | 'leader';
export type MembershipStatus = 'pending' | 'active';

export type Membership = {
  association_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
};

export type Association = { id: string; name: string; description: string };

const ROLE_LABELS: Record<MembershipRole, string> = {
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
 * Sets the caller's own link with an association. The database only accepts
 * "follower" or "member awaiting validation" here; anything higher is granted by a leader.
 */
export function setOwnMembership(
  associationId: string,
  userId: string,
  state: 'follower' | 'member-request'
) {
  return supabase.from('memberships').upsert(
    {
      association_id: associationId,
      user_id: userId,
      role: state === 'follower' ? 'follower' : 'member',
      status: state === 'follower' ? 'active' : 'pending',
    },
    { onConflict: 'association_id,user_id' }
  );
}

/** Unfollows the association entirely. */
export function deleteOwnMembership(associationId: string, userId: string) {
  return supabase
    .from('memberships')
    .delete()
    .eq('association_id', associationId)
    .eq('user_id', userId);
}

/** Leader action on someone else's membership (validated memberships are always active). */
export function setMemberRole(
  associationId: string,
  userId: string,
  role: Exclude<MembershipRole, 'leader'>
) {
  return supabase
    .from('memberships')
    .update({ role, status: 'active' })
    .eq('association_id', associationId)
    .eq('user_id', userId);
}
