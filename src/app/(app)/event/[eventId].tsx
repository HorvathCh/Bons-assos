import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Loading, Notice, Screen, Txt, useTheme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  EVENT_WITH_ASSOCIATION_COLUMNS,
  formatEventDate,
  PRESENCES,
  restrictionOf,
  type EventWithAssociation,
  type Presence,
} from '@/lib/events';
import { supabase } from '@/lib/supabase';

type Answer = { user_id: string; status: Presence; profile: { full_name: string } | null };

type Loaded = {
  event: EventWithAssociation | null;
  canManage: boolean;
  /** The user's own answer, and everyone's for the organisers. */
  answers: Answer[];
  error: string;
};

async function fetchEvent(eventId: string, userId: string): Promise<Loaded> {
  const { data: event, error } = await supabase
    .from('events')
    .select(EVENT_WITH_ASSOCIATION_COLUMNS)
    .eq('id', eventId)
    .maybeSingle()
    .overrideTypes<EventWithAssociation, { merge: false }>();
  if (!event) return { event: null, canManage: false, answers: [], error: error?.message ?? '' };

  const [membership, answers] = await Promise.all([
    supabase
      .from('memberships')
      .select('role, status')
      .eq('association_id', event.association_id)
      .eq('user_id', userId)
      .maybeSingle(),
    // Row level security returns every answer to the organisers, and only their own to others.
    event.requires_presence
      ? supabase
          .from('event_attendances')
          .select('user_id, status, profile:profiles!user_id(full_name)')
          .eq('event_id', eventId)
          .overrideTypes<Answer[], { merge: false }>()
      : null,
  ]);
  // Same rule as the database: leaders and committee members of the association.
  const canManage =
    membership.data?.status === 'active' &&
    (membership.data.role === 'leader' || membership.data.role === 'committee');
  return { event, canManage, answers: answers?.data ?? [], error: answers?.error?.message ?? '' };
}

export default function EventDetails() {
  const theme = useTheme();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { session, isAdmin } = useAuth();
  const userId = session?.user.id;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [answering, setAnswering] = useState(false);

  // Reloaded when coming back from the edit screen.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      fetchEvent(eventId, userId).then((next) => {
        if (!cancelled) setLoaded(next);
      });
      return () => {
        cancelled = true;
      };
    }, [eventId, userId])
  );

  if (!loaded || !userId) return <Loading />;

  const { event, answers } = loaded;
  if (!event) {
    return (
      <Screen>
        <Notice kind="error">
          {loaded.error || 'Cet événement n’existe plus ou ne vous est pas destiné.'}
        </Notice>
      </Screen>
    );
  }

  const answer = async (status: Presence) => {
    setAnswering(true);
    const { error } = await supabase
      .from('event_attendances')
      .upsert(
        { event_id: event.id, user_id: userId, status, updated_at: new Date().toISOString() },
        { onConflict: 'event_id,user_id' }
      );
    setError(error?.message ?? '');
    setLoaded(await fetchEvent(eventId, userId));
    setAnswering(false);
  };

  const restriction = restrictionOf(event);
  const canManage = loaded.canManage || isAdmin;
  const mine = answers.find((item) => item.user_id === userId)?.status;
  const namesOf = (status: Presence) =>
    answers
      .filter((item) => item.status === status)
      .map((item) => item.profile?.full_name || 'Sans nom')
      .sort((a, b) => a.localeCompare(b, 'fr'));

  return (
    <Screen onRefresh={() => fetchEvent(eventId, userId).then(setLoaded)}>
      <Link
        href={{ pathname: '/association/[id]', params: { id: event.association_id } }}
        style={[styles.association, { color: theme.primary }]}>
        {event.association?.name}
      </Link>
      <Txt variant="title">{event.title}</Txt>
      <Txt style={styles.date}>{formatEventDate(event)}</Txt>
      {event.location ? <Txt>{event.location}</Txt> : null}
      {restriction ? <Txt variant="secondary">{restriction}</Txt> : null}
      {event.description ? <Txt>{event.description}</Txt> : null}
      <Notice kind="error">{error || loaded.error}</Notice>

      {/* The platform admin oversees events but is not one of the people invited. */}
      {event.requires_presence && !isAdmin ? (
        <Card>
          <Txt variant="heading">Votre présence</Txt>
          <Txt variant="secondary">
            {mine
              ? 'Vous pouvez modifier votre réponse à tout moment.'
              : 'Merci d’indiquer si vous serez présent.'}
          </Txt>
          <View style={styles.choices}>
            {PRESENCES.map((option) => (
              <Button
                key={option.value}
                title={option.answer}
                variant={mine === option.value ? 'primary' : 'secondary'}
                compact
                disabled={answering}
                onPress={() => {
                  if (mine !== option.value) answer(option.value);
                }}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {event.requires_presence && canManage ? (
        <Card>
          <Txt variant="heading">Réponses</Txt>
          {PRESENCES.map((option) => {
            const names = namesOf(option.value);
            return (
              <View key={option.value}>
                <Txt>
                  {option.label}s : {names.length}
                </Txt>
                {names.length > 0 ? <Txt variant="secondary">{names.join(', ')}</Txt> : null}
              </View>
            );
          })}
        </Card>
      ) : null}

      {canManage ? (
        <Button
          title="Modifier ou supprimer"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/association/[id]/event/[eventId]',
              params: { id: event.association_id, eventId: event.id },
            })
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  association: { fontSize: 16, paddingVertical: 4 },
  date: { textTransform: 'capitalize' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
