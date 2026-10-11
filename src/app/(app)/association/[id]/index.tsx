import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Loading, Notice, Screen, Txt, useTheme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatEventDate, restrictionOf, type AssociationEvent } from '@/lib/events';
import {
  ASSOCIATION_DETAILS_COLUMNS,
  formatLongDay,
  setOwnLevel,
  type AssociationDetails,
  type Membership,
} from '@/lib/memberships';
import { supabase } from '@/lib/supabase';

type Details = {
  association: AssociationDetails | null;
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
      .select(ASSOCIATION_DETAILS_COLUMNS)
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
      .select('id, title, description, location, starts_at, ends_at, audience, requires_presence')
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

/** A labelled line of the information card; tappable when it opens mail or phone. */
function InfoRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <View>
      <Txt variant="secondary">{label}</Txt>
      {onPress ? (
        <Txt accessibilityRole="link" onPress={onPress} style={{ color: theme.primary }}>
          {value}
        </Txt>
      ) : (
        <Txt>{value}</Txt>
      )}
    </View>
  );
}

export default function AssociationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isAdmin } = useAuth();
  const userId = session?.user.id;

  const [details, setDetails] = useState<Details | null>(null);
  const [following, setFollowing] = useState(false);

  // What a user sees depends on their level in the association, which they or a leader can
  // change at any time: reload each time the screen comes back to the front, and when the
  // app itself comes back to the foreground.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      const load = () =>
        fetchDetails(id, userId).then((next) => {
          if (!cancelled) setDetails(next);
        });
      load();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') load();
      });
      return () => {
        cancelled = true;
        subscription.remove();
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
  const canManageEvents =
    isAdmin ||
    (membership?.status === 'active' &&
      (membership.role === 'leader' || membership.role === 'committee'));

  // Same rule as the database: the leaders of the association and platform admins.
  const canEditAssociation =
    isAdmin || (membership?.status === 'active' && membership.role === 'leader');
  const hasInfo =
    association.founded_on ||
    association.president_name ||
    association.contact_email ||
    association.contact_phone ||
    association.hq_address ||
    association.employee_count !== null;

  const follow = async () => {
    setFollowing(true);
    await setOwnLevel(id, userId, 'follower');
    setDetails(await fetchDetails(id, userId));
    setFollowing(false);
  };

  return (
    <Screen onRefresh={() => fetchDetails(id, userId).then(setDetails)}>
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

      <Card>
        {association.founded_on ? (
          <InfoRow label="Créée le" value={formatLongDay(association.founded_on)} />
        ) : null}
        {association.president_name ? (
          <InfoRow label="Président" value={association.president_name} />
        ) : null}
        {association.contact_email ? (
          <InfoRow
            label="Email"
            value={association.contact_email}
            onPress={() => Linking.openURL(`mailto:${association.contact_email}`)}
          />
        ) : null}
        {association.contact_phone ? (
          <InfoRow
            label="Téléphone"
            value={association.contact_phone}
            onPress={() => Linking.openURL(`tel:${association.contact_phone}`)}
          />
        ) : null}
        {association.hq_address ? <InfoRow label="Siège" value={association.hq_address} /> : null}
        {association.employee_count !== null ? (
          <InfoRow label="Salariés" value={String(association.employee_count)} />
        ) : null}
        {hasInfo ? null : (
          <Txt variant="secondary">
            Les informations de l’association n’ont pas encore été renseignées.
          </Txt>
        )}
        {canEditAssociation ? (
          <Button
            title="Modifier les informations"
            variant="secondary"
            compact
            onPress={() => router.push({ pathname: '/association/[id]/edit', params: { id } })}
          />
        ) : null}
      </Card>

      {!membership && !isAdmin ? (
        <Button title="Suivre cette association" loading={following} onPress={follow} />
      ) : null}

      <Txt variant="heading">Prochains événements</Txt>

      {canManageEvents ? (
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
          {restrictionOf(event) ? <Txt variant="secondary">{restrictionOf(event)}</Txt> : null}
          {event.location ? <Txt variant="secondary">{event.location}</Txt> : null}
          {event.description ? <Txt>{event.description}</Txt> : null}
          <Button
            title={event.requires_presence ? 'Voir et déclarer ma présence' : 'Voir le détail'}
            variant="secondary"
            compact
            onPress={() =>
              router.push({ pathname: '/event/[eventId]', params: { eventId: event.id } })
            }
          />
          {canManageEvents ? (
            <Button
              title="Modifier ou supprimer"
              variant="secondary"
              compact
              onPress={() =>
                router.push({
                  pathname: '/association/[id]/event/[eventId]',
                  params: { id, eventId: event.id },
                })
              }
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  date: { textTransform: 'capitalize' },
});
