import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { InviteLeaderForm } from '@/components/invite-leader-form';
import { Button, Card, Loading, Notice, Screen, Txt, useTheme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  deleteMembership,
  MEMBERSHIP_COLUMNS,
  membershipLabel,
  OWN_LEVELS,
  setOwnLevel,
  type Association,
  type Membership,
} from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

type Member = Membership & { profile: { full_name: string } | null };
type Details = { association: Association | null; members: Member[]; error: string };

async function fetchDetails(associationId: string): Promise<Details> {
  const [association, members] = await Promise.all([
    supabase
      .from('associations')
      .select('id, name, description')
      .eq('id', associationId)
      .maybeSingle(),
    // Row level security returns the whole list to leaders and committee members,
    // and only their own row to everyone else.
    supabase
      .from('memberships')
      .select(`${MEMBERSHIP_COLUMNS}, profile:profiles!user_id(full_name)`)
      .eq('association_id', associationId)
      .order('created_at')
      .overrideTypes<Member[], { merge: false }>(),
  ]);
  return {
    association: association.data,
    members: members.data ?? [],
    error: association.error?.message ?? members.error?.message ?? '',
  };
}

const memberName = (member: Member) => member.profile?.full_name || 'Sans nom';

/** "Membre actif · Cotisation à jour · Responsable d’équipe"; dues are the leaders' business. */
function memberSummary(member: Member, withDues: boolean) {
  const parts = [membershipLabel(member)];
  if (withDues && member.role !== 'follower') {
    parts.push(member.dues_up_to_date ? 'Cotisation à jour' : 'Cotisation non à jour');
  }
  if (member.is_team_manager) parts.push('Responsable d’équipe');
  return parts.join(' · ');
}

export default function AssociationMembers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { session, isAdmin } = useAuth();
  const userId = session?.user.id;

  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Reloaded each time the screen comes back to the front (after editing a member...).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchDetails(id).then((next) => {
        if (!cancelled) setDetails(next);
      });
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  if (!details || !userId) return <Loading />;

  const { association, members } = details;
  if (!association) {
    return (
      <Screen>
        <Notice kind="error">{details.error || 'Association introuvable.'}</Notice>
      </Screen>
    );
  }

  /** Runs a change, then reloads so the screen shows what the database accepted. */
  const run = async (change: PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    const { error } = await change;
    setError(error?.message ?? '');
    setDetails(await fetchDetails(id));
    setBusy(false);
  };

  const mine = members.find((member) => member.user_id === userId);
  const isLeader = mine?.role === 'leader';
  const canManage = isLeader || isAdmin;

  // Leaders and admins see everyone and can set any level; the committee sees the members.
  const listed = members.filter((member) => canManage || member.role !== 'follower');
  const followerCount = members.filter((member) => member.role === 'follower').length;
  const showMembers = canManage || mine?.role === 'committee';

  return (
    <Screen>
      <Notice kind="error">{error || details.error}</Notice>

      {isAdmin ? null : (
        <Card>
          <Txt variant="heading">
            {mine ? membershipLabel(mine) : 'Vous ne suivez pas cette association'}
          </Txt>

          {mine && mine.role !== 'follower' ? (
            <Txt variant="secondary">
              {mine.dues_up_to_date ? 'Cotisation à jour' : 'Cotisation non à jour'}
              {mine.is_team_manager ? ' · Responsable d’équipe' : ''}
            </Txt>
          ) : null}

          {isLeader ? null : (
            <>
              <Txt variant="secondary">
                Choisissez vous-même votre lien avec l’association : abonné pour suivre ses
                actualités, ou membre actif si vous en faites partie.
              </Txt>
              <View style={styles.actions}>
                {OWN_LEVELS.map((level) => (
                  <Button
                    key={level.role}
                    title={level.label}
                    variant={mine?.role === level.role ? 'primary' : 'secondary'}
                    compact
                    disabled={busy}
                    onPress={() => {
                      if (mine?.role !== level.role) run(setOwnLevel(id, userId, level.role));
                    }}
                  />
                ))}
              </View>
              {mine?.role === 'committee' ? (
                <Txt variant="secondary">
                  Choisir l’un de ces niveaux vous fait quitter le comité.
                </Txt>
              ) : null}
            </>
          )}

          {mine && !isLeader ? (
            <Button
              title="Ne plus suivre"
              variant="danger"
              disabled={busy}
              onPress={() => run(deleteMembership(id, userId))}
            />
          ) : null}

          {isLeader ? (
            <Txt variant="secondary">
              Touchez une personne dans la liste pour gérer son niveau, sa cotisation ou la nommer
              responsable d’équipe.
            </Txt>
          ) : null}
        </Card>
      )}

      {showMembers ? (
        <Card>
          <Txt variant="heading">Membres</Txt>
          {listed.length === 0 ? <Txt variant="secondary">Aucun membre pour le moment.</Txt> : null}
          {listed.map((member) => {
            const row = (
              <View>
                <Txt>
                  {memberName(member)}
                  {member.user_id === userId ? ' (vous)' : ''}
                </Txt>
                <Txt variant="secondary">{memberSummary(member, canManage)}</Txt>
              </View>
            );
            // Leaders are managed by the platform admin, by invitation only.
            return canManage && member.role !== 'leader' ? (
              <Link
                key={member.user_id}
                href={{
                  pathname: '/association/[id]/member/[userId]',
                  params: { id, userId: member.user_id },
                }}
                asChild>
                <Pressable
                  accessibilityRole="link"
                  style={({ pressed }) => [
                    styles.memberLink,
                    { borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}>
                  {row}
                  <Txt variant="secondary">›</Txt>
                </Pressable>
              </Link>
            ) : (
              <View key={member.user_id}>{row}</View>
            );
          })}
          {canManage ? null : (
            <Txt variant="secondary">
              {followerCount} abonné{followerCount > 1 ? 's' : ''}
            </Txt>
          )}
        </Card>
      ) : null}

      {isAdmin ? (
        <Card>
          <Txt variant="heading">Responsable</Txt>
          <InviteLeaderForm
            associationId={id}
            onInvited={() => fetchDetails(id).then(setDetails)}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  memberLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  pressed: { opacity: 0.6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
