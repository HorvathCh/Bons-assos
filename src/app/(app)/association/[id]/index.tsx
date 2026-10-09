import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Button, Card, Loading, Notice, Screen, Txt, useTheme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatEventDate, type AssociationEvent } from '@/lib/events';
import { setOwnMembership, type Association, type Membership } from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

type Details = {
  association: Association | null;
  membership: Pick<Membership, 'role' | 'status'> | null;
  events: AssociationEvent[];
  error: string;
};

async function fetchDetails(associationId: string, userId: string): Promise<Details> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [association, membership, events] = await Promise.all([
    supabase
      .from('associations')
      .select('id, name, description')
      .eq('id', associationId)
      .maybeSingle(),
    supabase
      .from('memberships')
      .select('role, status')
      .eq('association_id', associationId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('events')
      .select('id, title, description, location, starts_at, ends_at')
      .eq('association_id', associationId)
      .gte('starts_at', startOfToday.toISOString())
      .order('starts_at'),
  ]);
  return {
    association: association.data,
    membership: membership.data,
    events: events.data ?? [],
    error: association.error?.message ?? membership.error?.message ?? events.error?.message ?? '',
  };
}

export default function AssociationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isAdmin } = useAuth();
  const userId = session?.user.id;

  const [details, setDetails] = useState<Details | null>(null);
  const [following, setFollowing] = useState(false);

  // Reloaded each time the screen comes back to the front (after creating an event...).
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      fetchDetails(id, userId).then((next) => {
        if (!cancelled) setDetails(next);
      });
      return () => {
        cancelled = true;
      };
    }, [id, userId])
  );

  if (!details || !userId) return <Loading />;

  const { association, membership, events } = details;
  if (!association) {
    return (
      <Screen>
        <Notice kind="error">{details.error || 'Association introuvable.'}</Notice>
      </Screen>
    );
  }

  // Same rule as the database: leaders, committee members and platform admins.
  const canCreateEvents =
    isAdmin ||
    (membership?.status === 'active' &&
      (membership.role === 'leader' || membership.role === 'committee'));

  const follow = async () => {
    setFollowing(true);
    await setOwnMembership(id, userId, 'follower');
    setDetails(await fetchDetails(id, userId));
    setFollowing(false);
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: association.name,
          headerRight: () => (
            <Link href={{ pathname: '/association/[id]/members', params: { id } }} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="Membres" hitSlop={12}>
                <SymbolView
                  name={{ ios: 'person.2', android: 'group', web: 'group' }}
                  size={26}
                  tintColor={theme.primary}
                  fallback={<Txt style={{ color: theme.primary }}>Membres</Txt>}
                />
              </Pressable>
            </Link>
          ),
        }}
      />
      {association.description ? <Txt>{association.description}</Txt> : null}
      <Notice kind="error">{details.error}</Notice>

      {!membership && !isAdmin ? (
        <Button title="Suivre cette association" loading={following} onPress={follow} />
      ) : null}

      <Txt variant="heading">Prochains événements</Txt>

      {canCreateEvents ? (
        <Button
          title="Créer un événement"
          onPress={() => router.push({ pathname: '/association/[id]/new-event', params: { id } })}
        />
      ) : null}

      {events.length === 0 ? <Txt variant="secondary">Aucun événement à venir.</Txt> : null}

      {events.map((event) => (
        <Card key={event.id}>
          <Txt variant="secondary" style={[styles.date, { color: theme.primary }]}>
            {formatEventDate(event)}
          </Txt>
          <Txt variant="heading">{event.title}</Txt>
          {event.location ? <Txt variant="secondary">{event.location}</Txt> : null}
          {event.description ? <Txt>{event.description}</Txt> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  date: { textTransform: 'capitalize' },
});
