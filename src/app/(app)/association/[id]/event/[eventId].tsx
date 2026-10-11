import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { EventForm, type EventFormValues } from '@/components/event-form';
import { Button, Card, Loading, Notice, Screen, Txt } from '@/components/ui';
import { eventWriteError, type AssociationEvent } from '@/lib/events';
import { supabase } from '@/lib/supabase';

type Loaded = { event: AssociationEvent | null; error: string };

/** Leaders, committee members and platform admins only: the rule is enforced by the database. */
export default function EditEvent() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ id: string; eventId: string }>();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // Which deletion is waiting for a second tap.
  const [confirming, setConfirming] = useState<'event' | 'series' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('events')
      .select(
        'id, title, description, location, starts_at, ends_at, audience, requires_presence, series_id'
      )
      .eq('id', eventId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled) setLoaded({ event: data, error: error?.message ?? '' });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!loaded) return <Loading />;

  const { event } = loaded;
  if (!event) {
    return (
      <Screen>
        <Notice kind="error">{loaded.error || 'Événement introuvable.'}</Notice>
      </Screen>
    );
  }

  const save = async ({ fields, starts, endOf }: EventFormValues) => {
    const { data, error } = await supabase
      .from('events')
      .update({ ...fields, starts_at: starts[0].toISOString(), ends_at: endOf(starts[0]) })
      .eq('id', event.id)
      .select('id');
    if (error) return eventWriteError(error);
    // Without the right to edit, the database changes nothing and reports no error.
    if (data.length === 0) return eventWriteError({ code: '42501', message: '' });
    router.back();
    return null;
  };

  const remove = async (scope: 'event' | 'series') => {
    setDeleting(true);
    const deletion = supabase.from('events').delete();
    const { data, error } = await (
      scope === 'series' && event.series_id
        ? // The rest of the series: this date and the following ones.
          deletion.eq('series_id', event.series_id).gte('starts_at', event.starts_at)
        : deletion.eq('id', event.id)
    ).select('id');
    if (error || data.length === 0) {
      setDeletionError(eventWriteError(error ?? { code: '42501', message: '' }));
      setDeleting(false);
      setConfirming(null);
      return;
    }
    router.back();
  };

  return (
    <EventForm
      initial={{
        title: event.title,
        start: new Date(event.starts_at),
        end: event.ends_at ? new Date(event.ends_at) : null,
        audience: event.audience,
        requiresPresence: event.requires_presence,
        location: event.location ?? '',
        description: event.description ?? '',
      }}
      submitLabel={() => 'Enregistrer'}
      onSubmit={save}>
      <Card>
        <Txt variant="heading">Supprimer</Txt>
        {event.series_id ? (
          <Txt variant="secondary">
            Cet événement fait partie d’une série. Les modifications ci-dessus ne concernent que
            cette date.
          </Txt>
        ) : null}
        <Notice kind="error">{deletionError}</Notice>
        {confirming ? (
          <>
            <Button
              title={
                confirming === 'series'
                  ? 'Oui, supprimer cette date et les suivantes'
                  : 'Oui, supprimer cet événement'
              }
              variant="danger"
              loading={deleting}
              onPress={() => remove(confirming)}
            />
            <Button
              title="Annuler"
              variant="secondary"
              disabled={deleting}
              onPress={() => setConfirming(null)}
            />
          </>
        ) : (
          <>
            <Button
              title="Supprimer cet événement"
              variant="danger"
              onPress={() => setConfirming('event')}
            />
            {event.series_id ? (
              <Button
                title="Supprimer cette date et les suivantes"
                variant="danger"
                onPress={() => setConfirming('series')}
              />
            ) : null}
          </>
        )}
      </Card>
    </EventForm>
  );
}
