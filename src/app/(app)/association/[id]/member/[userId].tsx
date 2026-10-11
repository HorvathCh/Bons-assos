import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Loading, Notice, Screen, SwitchRow, Txt } from '@/components/ui';
import {
  deleteMembership,
  LEVELS,
  MEMBERSHIP_COLUMNS,
  membershipLabel,
  updateMember,
  type MemberChanges,
  type Membership,
} from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

type Member = Membership & { profile: { full_name: string } | null };
type Loaded = { member: Member | null; error: string };

async function fetchMember(associationId: string, userId: string): Promise<Loaded> {
  const { data, error } = await supabase
    .from('memberships')
    .select(`${MEMBERSHIP_COLUMNS}, profile:profiles!user_id(full_name)`)
    .eq('association_id', associationId)
    .eq('user_id', userId)
    .maybeSingle()
    .overrideTypes<Member, { merge: false }>();
  return { member: data, error: error?.message ?? '' };
}

/** Leaders and platform admins only: the rules are enforced by the database. */
export default function MemberProfile() {
  const router = useRouter();
  const { id, userId } = useLocalSearchParams<{ id: string; userId: string }>();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMember(id, userId).then((next) => {
      if (!cancelled) setLoaded(next);
    });
    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  if (!loaded) return <Loading />;

  const { member } = loaded;
  if (!member) {
    return (
      <Screen>
        <Notice kind="error">
          {loaded.error || 'Cette personne ne fait plus partie de l’association.'}
        </Notice>
      </Screen>
    );
  }

  /** Applies a change, then reloads so the screen shows what the database accepted. */
  const change = async (changes: MemberChanges) => {
    setBusy(true);
    const { error } = await updateMember(id, userId, changes);
    setError(error?.message ?? '');
    setLoaded(await fetchMember(id, userId));
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await deleteMembership(id, userId);
    if (error) {
      setError(error.message);
      setBusy(false);
      setConfirmingRemoval(false);
      return;
    }
    router.back();
  };

  const isFollower = member.role === 'follower';
  // Leaders are managed by the platform admin, by invitation only.
  const locked = busy || member.role === 'leader';

  return (
    <Screen>
      <View>
        <Txt variant="title">{member.profile?.full_name || 'Sans nom'}</Txt>
        <Txt variant="secondary">{membershipLabel(member)}</Txt>
      </View>
      <Notice kind="error">{error}</Notice>

      <Card>
        <Txt variant="heading">Niveau</Txt>
        <View style={styles.choices}>
          {LEVELS.map((level) => (
            <Button
              key={level.role}
              title={level.label}
              variant={member.role === level.role ? 'primary' : 'secondary'}
              compact
              disabled={locked}
              onPress={() => {
                if (member.role !== level.role) change({ role: level.role });
              }}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SwitchRow
          label="Cotisation à jour"
          hint={
            member.dues_up_to_date ? 'La cotisation est réglée.' : 'La cotisation reste à régler.'
          }
          value={member.dues_up_to_date}
          disabled={locked}
          onChange={(value) => change({ dues_up_to_date: value })}
        />
        <SwitchRow
          label="Responsable d’équipe"
          hint={
            isFollower
              ? 'Réservé aux membres actifs et au comité.'
              : 'Encadre une équipe de l’association.'
          }
          value={member.is_team_manager}
          disabled={locked || isFollower}
          onChange={(value) => change({ is_team_manager: value })}
        />
      </Card>

      {member.role === 'leader' ? null : (
        <Card>
          <Txt variant="heading">Retirer de l’association</Txt>
          <Txt variant="secondary">
            Cette personne ne sera plus ni membre ni abonnée. Elle pourra s’abonner à nouveau
            d’elle-même.
          </Txt>
          {confirmingRemoval ? (
            <>
              <Button title="Oui, retirer" variant="danger" loading={busy} onPress={remove} />
              <Button
                title="Annuler"
                variant="secondary"
                disabled={busy}
                onPress={() => setConfirmingRemoval(false)}
              />
            </>
          ) : (
            <Button
              title="Retirer de l’association"
              variant="danger"
              disabled={busy}
              onPress={() => setConfirmingRemoval(true)}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
