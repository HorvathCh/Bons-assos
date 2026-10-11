import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EventForm, type EventFormValues } from '@/components/event-form';
import { useAuth } from '@/lib/auth';
import { eventWriteError } from '@/lib/events';
import { supabase } from '@/lib/supabase';

/** Leaders, committee members and platform admins only: the rule is enforced by the database. */
export default function NewEvent() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const create = async ({ fields, starts, endOf }: EventFormValues) => {
    // A recurring meeting is one event per date, linked by a common series id.
    const seriesId = starts.length > 1 ? randomUUID() : null;
    const { error } = await supabase.from('events').insert(
      starts.map((startsAt) => ({
        ...fields,
        association_id: id,
        created_by: session?.user.id,
        starts_at: startsAt.toISOString(),
        ends_at: endOf(startsAt),
        series_id: seriesId,
      }))
    );
    if (error) return eventWriteError(error);
    router.back();
    return null;
  };

  return (
    <EventForm
      repeatable
      submitLabel={(count) => (count > 1 ? `Créer les ${count} événements` : 'Créer l’événement')}
      onSubmit={create}
    />
  );
}
