import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InviteLeaderForm } from '@/components/invite-leader-form';
import { Button, Card, Loading, Notice, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  deleteOwnMembership,
  membershipLabel,
  setMemberRole,
  setOwnMembership,
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
      .select('association_id, user_id, role, status, profile:profiles!user_id(full_name)')
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

export default function AssociationMembers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isAdmin } = useAuth();
  const userId = session?.user.id;

  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDetails(id).then((next) => {
      if (!cancelled) setDetails(next);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

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
  const others = members.filter((member) => member.user_id !== userId);
  const isLeader = mine?.role === 'leader';
  const canManage = isLeader || isAdmin;

  const requests = others.filter((member) => member.status === 'pending');
  // The platform admin sees everyone with their level; the association sees its members.
  const listed = members.filter(
    (member) => member.status === 'active' && (isAdmin || member.role !== 'follower')
  );
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

          {!mine ? (
            <>
              <Txt variant="secondary">
                Abonnez-vous gratuitement pour recevoir les actualités de l’association.
              </Txt>
              <Button
                title="Suivre"
                loading={busy}
                onPress={() => run(setOwnMembership(id, userId, 'follower'))}
              />
            </>
          ) : null}

          {!mine || mine.role === 'follower' ? (
            <>
              <Txt variant="secondary">
                Vous faites partie de l’association ? Déclarez-vous membre actif : un responsable
                validera votre demande.
              </Txt>
              <Button
                title="Je suis membre actif"
                variant="secondary"
                disabled={busy}
                onPress={() => run(setOwnMembership(id, userId, 'member-request'))}
              />
            </>
          ) : null}

          {mine?.status === 'pending' ? (
            <>
              <Txt variant="secondary">
                Un responsable de l’association doit valider votre demande. En attendant, vous
                recevez ses actualités comme abonné.
              </Txt>
              <Button
                title="Annuler ma demande"
                variant="secondary"
                disabled={busy}
                onPress={() => run(setOwnMembership(id, userId, 'follower'))}
              />
            </>
          ) : null}

          {mine?.status === 'active' && (mine.role === 'member' || mine.role === 'committee') ? (
            <Button
              title="Quitter l’association (rester abonné)"
              variant="secondary"
              disabled={busy}
              onPress={() => run(setOwnMembership(id, userId, 'follower'))}
            />
          ) : null}

          {mine && !isLeader ? (
            <Button
              title="Ne plus suivre"
              variant="danger"
              disabled={busy}
              onPress={() => run(deleteOwnMembership(id, userId))}
            />
          ) : null}

          {isLeader ? (
            <Txt variant="secondary">
              Vous validez les demandes d’adhésion et désignez les membres du comité.
            </Txt>
          ) : null}
        </Card>
      )}

      {canManage && (!isAdmin || requests.length > 0) ? (
        <Card>
          <Txt variant="heading">Demandes d’adhésion</Txt>
          {requests.length === 0 ? <Txt variant="secondary">Aucune demande en attente.</Txt> : null}
          {requests.map((member) => (
            <View key={member.user_id} style={styles.member}>
              <Txt>{memberName(member)}</Txt>
              <View style={styles.actions}>
                <Button
                  title="Valider"
                  compact
                  disabled={busy}
                  onPress={() => run(setMemberRole(id, member.user_id, 'member'))}
                />
                <Button
                  title="Refuser"
                  variant="danger"
                  compact
                  disabled={busy}
                  onPress={() => run(setMemberRole(id, member.user_id, 'follower'))}
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {showMembers ? (
        <Card>
          <Txt variant="heading">Membres</Txt>
          {members.length === 0 ? (
            <Txt variant="secondary">Aucun membre pour le moment.</Txt>
          ) : null}
          {listed.map((member) => (
            <View key={member.user_id} style={styles.member}>
              <View>
                <Txt>
                  {memberName(member)}
                  {member.user_id === userId ? ' (vous)' : ''}
                </Txt>
                <Txt variant="secondary">{membershipLabel(member)}</Txt>
              </View>
              {canManage && (member.role === 'member' || member.role === 'committee') ? (
                <View style={styles.actions}>
                  <Button
                    title={member.role === 'committee' ? 'Retirer du comité' : 'Nommer au comité'}
                    variant="secondary"
                    compact
                    disabled={busy}
                    onPress={() =>
                      run(
                        setMemberRole(
                          id,
                          member.user_id,
                          member.role === 'committee' ? 'member' : 'committee'
                        )
                      )
                    }
                  />
                  <Button
                    title="Retirer"
                    variant="danger"
                    compact
                    disabled={busy}
                    onPress={() => run(setMemberRole(id, member.user_id, 'follower'))}
                  />
                </View>
              ) : null}
            </View>
          ))}
          {isAdmin ? null : (
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
  member: { gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
