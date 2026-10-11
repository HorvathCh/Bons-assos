import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { Button, Card, Field, Notice, Screen, SwitchRow, Txt } from '@/components/ui';
import {
  atTimeOf,
  AUDIENCES,
  formatDay,
  occurrences,
  oneYearAfter,
  type EventAudience,
  type Recurrence,
} from '@/lib/events';

const HOUR = 60 * 60 * 1000;

/** The next full hour, as a sensible starting point. */
function nextHour() {
  const date = new Date(Date.now() + HOUR);
  date.setMinutes(0, 0, 0);
  return date;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** What the form hands over: the columns of an event, and one start per date to create. */
export type EventFormValues = {
  fields: {
    title: string;
    description: string | null;
    location: string | null;
    audience: EventAudience;
    requires_presence: boolean;
  };
  starts: Date[];
  /** End of the event that starts at `startsAt`, as an ISO date, or null. */
  endOf: (startsAt: Date) => string | null;
};

type Props = {
  initial?: {
    title: string;
    start: Date;
    end: Date | null;
    audience: EventAudience;
    requiresPresence: boolean;
    location: string;
    description: string;
  };
  /** Offers to repeat the event; only meaningful when creating. */
  repeatable?: boolean;
  submitLabel: (count: number) => string;
  /** Saves the event(s). Returns an error message, or null once saved. */
  onSubmit: (values: EventFormValues) => Promise<string | null>;
  /** Extra actions under the submit button. */
  children?: ReactNode;
};

export function EventForm({ initial, repeatable = false, submitLabel, onSubmit, children }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  // Day and start time of the event; the end is a time on that same day.
  const [start, setStart] = useState(() => initial?.start ?? nextHour());
  const [end, setEnd] = useState<Date | null>(initial?.end ?? null);
  const [audience, setAudience] = useState<EventAudience>(initial?.audience ?? 'members');
  const [requiresPresence, setRequiresPresence] = useState(initial?.requiresPresence ?? false);
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  // Last day of the series; one year after the start until the user picks one.
  const [chosenUntil, setChosenUntil] = useState<Date | null>(null);
  const [location, setLocation] = useState(initial?.location ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const latestUntil = oneYearAfter(start);
  const until = chosenUntil && chosenUntil < latestUntil ? chosenUntil : latestUntil;
  const starts = occurrences(start, recurrence, until);
  const recurrences: { value: Recurrence; label: string }[] = [
    { value: 'none', label: 'Une seule fois' },
    { value: 'weekly', label: 'Chaque semaine' },
  ];

  const submit = async () => {
    // The button stays active so that a tap always says what is missing.
    if (!title.trim()) {
      setError('Donnez un titre à l’événement.');
      return;
    }
    if (start < new Date()) {
      setError('Cette date est déjà passée.');
      return;
    }
    if (end && atTimeOf(start, end) <= start) {
      setError('L’heure de fin doit être après l’heure de début.');
      return;
    }
    if (starts.length === 0) {
      setError('La fin de la répétition doit être après la date de l’événement.');
      return;
    }

    setError('');
    setSubmitting(true);
    const message = await onSubmit({
      fields: {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        audience,
        requires_presence: requiresPresence,
      },
      starts,
      endOf: (startsAt) => (end ? atTimeOf(startsAt, end).toISOString() : null),
    });
    if (message) {
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Field label="Titre" value={title} onChangeText={setTitle} />

      <Card>
        <DateTimeField
          label="Date"
          mode="date"
          value={start}
          minimumDate={startOfToday()}
          onChange={(day) => setStart(atTimeOf(day, start))}
        />
        <DateTimeField
          label="Début"
          mode="time"
          value={start}
          onChange={(time) => setStart(atTimeOf(start, time))}
        />
        {end ? (
          <>
            <DateTimeField label="Fin" mode="time" value={end} onChange={setEnd} />
            <Button
              title="Retirer l’heure de fin"
              variant="secondary"
              compact
              onPress={() => setEnd(null)}
            />
          </>
        ) : (
          <Button
            title="Ajouter une heure de fin"
            variant="secondary"
            compact
            onPress={() => setEnd(new Date(start.getTime() + HOUR))}
          />
        )}
      </Card>

      {repeatable ? (
        <View style={styles.group}>
          <Txt variant="secondary">Répétition</Txt>
          <View style={styles.choices}>
            {recurrences.map((option) => (
              <Button
                key={option.value}
                title={option.label}
                variant={recurrence === option.value ? 'primary' : 'secondary'}
                compact
                onPress={() => setRecurrence(option.value)}
              />
            ))}
            {/* Custom patterns (every two weeks, monthly...) are still to be built. */}
            <Button
              title="Personnalisée (bientôt)"
              variant="secondary"
              compact
              disabled
              onPress={() => {}}
            />
          </View>
          {recurrence !== 'none' ? (
            <>
              <DateTimeField
                label="Jusqu’au"
                mode="date"
                value={until}
                minimumDate={start}
                maximumDate={latestUntil}
                onChange={setChosenUntil}
              />
              <Txt variant="secondary">
                {starts.length === 0
                  ? 'Aucune date : choisissez une fin après la date de l’événement.'
                  : `${starts.length} dates, la dernière le ${formatDay(starts[starts.length - 1])}.`}{' '}
                Une série dure un an au maximum.
              </Txt>
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.group}>
        <Txt variant="secondary">Qui est invité ?</Txt>
        <View style={styles.choices}>
          {AUDIENCES.map((option) => (
            <Button
              key={option.value}
              title={option.label}
              variant={audience === option.value ? 'primary' : 'secondary'}
              compact
              onPress={() => setAudience(option.value)}
            />
          ))}
        </View>
        <Txt variant="secondary">
          {audience === 'everyone'
            ? 'L’événement est visible par tous.'
            : audience === 'members'
              ? 'Seuls les membres actifs, le comité et les responsables voient l’événement.'
              : 'Seuls le comité et les responsables voient l’événement.'}
        </Txt>
      </View>

      <SwitchRow
        label="Demander de déclarer sa présence"
        hint="Chaque invité indique s’il sera présent ou absent."
        value={requiresPresence}
        onChange={setRequiresPresence}
      />

      <Field label="Lieu (facultatif)" value={location} onChangeText={setLocation} />
      <Field
        label="Description (facultatif)"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Notice kind="error">{error}</Notice>
      <Button title={submitLabel(starts.length)} onPress={submit} loading={submitting} />
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
