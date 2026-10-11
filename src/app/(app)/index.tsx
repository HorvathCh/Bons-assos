import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet } from 'react-native';

import { Button, Loading, Notice, Screen, Txt, useTheme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  EVENT_WITH_ASSOCIATION_COLUMNS,
  formatEventDate,
  presenceLabel,
  type EventWithAssociation,
  type Presence,
} from '@/lib/events';
import { supabase } from '@/lib/supabase';

type Agenda = {
  events: EventWithAssociation[];
  /** The user's own answers, by event id. */
  presences: Record<string, Presence>;
  followsAny: boolean;
  error: string;
};

/** Upcoming events of the associations the user follows or belongs to. */
async function fetchAgenda(userId: string): Promise<Agenda> {
  const memberships = await supabase
    .from('memberships')
    .select('association_id')
    .eq('user_id', userId);
  const associationIds = (memberships.data ?? []).map((row) => row.association_id);
  if (memberships.error || associationIds.length === 0) {
    return {
      events: [],
      presences: {},
      followsAny: false,
      error: memberships.error?.message ?? '',
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  // Row level security keeps only the events addressed to the user's level in each association.
  const events = await supabase
    .from('events')
    .select(EVENT_WITH_ASSOCIATION_COLUMNS)
    .in('association_id', associationIds)
    .gte('starts_at', startOfToday.toISOString())
    .order('starts_at')
    .overrideTypes<EventWithAssociation[], { merge: false }>();

  const asked = (events.data ?? []).filter((event) => event.requires_presence);
  const answers = asked.length
    ? await supabase
        .from('event_attendances')
        .select('event_id, status')
        .eq('user_id', userId)
        .in(
          'event_id',
          asked.map((event) => event.id)
        )
    : null;
  const presences: Record<string, Presence> = {};
  for (const answer of answers?.data ?? []) presences[answer.event_id] = answer.status;

  return {
    events: events.data ?? [],
    presences,
    followsAny: true,
    error: events.error?.message ?? answers?.error?.message ?? '',
  };
}

export default function MyEvents() {
  const theme = useTheme();
  const router = useRouter();
  const { session, accountLoaded, isAdmin } = useAuth();
  const userId = session?.user.id;

  const [agenda, setAgenda] = useState<Agenda | null>(null);

  // Reloaded when the screen or the app comes back to the front: following an association
  // or changing level changes what the user is invited to.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      const load = () =>
        fetchAgenda(userId).then((next) => {
          if (!cancelled) setAgenda(next);
        });
      load();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') load();
      });
      return () => {
        cancelled = true;
        subscription.remove();
      };
    }, [userId])
  );

  // A new user has nothing to see here yet: the first time, send them straight to the
  // subscribe form. Remembered on the device so that coming back does not send them again.
  const isNewcomer = accountLoaded && !isAdmin && agenda?.followsAny === false && !agenda.error;
  useEffect(() => {
    if (!isNewcomer || !userId) return;
    let cancelled = false;
    const key = `welcomed:${userId}`;
    AsyncStorage.getItem(key).then((welcomed) => {
      if (welcomed || cancelled) return;
      AsyncStorage.setItem(key, '1');
      router.push('/subscribe');
    });
    return () => {
      cancelled = true;
    };
  }, [isNewcomer, userId, router]);

  // The platform admin manages associations rather than attending their events.
  if (accountLoaded && isAdmin) return <Redirect href="/associations" />;
  if (!agenda || !userId || !accountLoaded) return <Loading />;

  return (
    <Screen
      onRefresh={() => fetchAgenda(userId).then(setAgenda)}
      footer={
        <Button
          title="Mes associations"
          variant={agenda.followsAny ? 'secondary' : 'primary'}
          onPress={() => router.push('/my-associations')}
        />
      }>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/account" style={[styles.headerLink, { color: theme.primary }]}>
              Mon compte
            </Link>
          ),
        }}
      />
      <Notice kind="error">{agenda.error}</Notice>

      {agenda.events.length === 0 && !agenda.error ? (
        <Txt variant="secondary">
          {agenda.followsAny
            ? 'Aucun événement à venir pour le moment.'
            : 'Abonnez-vous à une association pour voir ici les événements auxquels vous êtes invité.'}
        </Txt>
      ) : null}

      {agenda.events.map((event) => (
        <Link
          key={event.id}
          href={{ pathname: '/event/[eventId]', params: { eventId: event.id } }}
          asChild>
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.surface },
              pressed && styles.pressed,
            ]}>
            <Txt variant="secondary">{event.association?.name}</Txt>
            <Txt variant="heading">{event.title}</Txt>
            <Txt variant="secondary" style={[styles.date, { color: theme.primary }]}>
              {formatEventDate(event)}
            </Txt>
            {event.requires_presence ? (
              <Txt
                variant="secondary"
                style={[
                  styles.presence,
                  { color: agenda.presences[event.id] ? theme.textSecondary : theme.danger },
                ]}>
                {presenceLabel(agenda.presences[event.id])}
              </Txt>
            ) : null}
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerLink: { fontSize: 16, paddingVertical: 8 },
  row: { borderRadius: 12, padding: 16, gap: 4 },
  date: { textTransform: 'capitalize' },
  presence: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
