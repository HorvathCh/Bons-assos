import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Field, Notice, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { parseDateTime } from '@/lib/events';
import { supabase } from '@/lib/supabase';

/** Leaders, committee members and platform admins only: the rule is enforced by the database. */
export default function NewEvent() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const startsAt = parseDateTime(date, startTime);
    const endsAt = endTime.trim() ? parseDateTime(date, endTime) : null;
    if (!startsAt) {
      setError('Indiquez la date au format JJ/MM/AAAA et l’heure au format HH:MM.');
      return;
    }
    if (endTime.trim() && (!endsAt || endsAt <= startsAt)) {
      setError('L’heure de fin doit être au format HH:MM et après l’heure de début.');
      return;
    }
    if (startsAt < new Date()) {
      setError('Cette date est déjà passée.');
      return;
    }

    setError('');
    setSubmitting(true);
    const { error } = await supabase.from('events').insert({
      association_id: id,
      created_by: session?.user.id,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
    });
    if (error) {
      setError(
        error.code === '42501'
          ? 'Seuls les responsables et les membres du comité peuvent créer un événement.'
          : error.message
      );
      setSubmitting(false);
      return;
    }
    router.back();
  };

  return (
    <Screen>
      <Field label="Titre" value={title} onChangeText={setTitle} />
      <Field
        label="Date (JJ/MM/AAAA)"
        value={date}
        onChangeText={setDate}
        placeholder="25/12/2026"
        keyboardType="numbers-and-punctuation"
      />
      <View style={styles.times}>
        <View style={styles.time}>
          <Field
            label="Début (HH:MM)"
            value={startTime}
            onChangeText={setStartTime}
            placeholder="14:00"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.time}>
          <Field
            label="Fin (facultatif)"
            value={endTime}
            onChangeText={setEndTime}
            placeholder="16:00"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
      <Field label="Lieu (facultatif)" value={location} onChangeText={setLocation} />
      <Field
        label="Description (facultatif)"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Notice kind="error">{error}</Notice>
      <Button
        title="Créer l’événement"
        onPress={submit}
        loading={submitting}
        disabled={!title.trim() || !date.trim() || !startTime.trim()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  times: { flexDirection: 'row', gap: 12 },
  time: { flex: 1 },
});
