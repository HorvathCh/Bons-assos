export type EventAudience = 'everyone' | 'members' | 'committee';

export type AssociationEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  audience: EventAudience;
  /** The people invited are asked to say whether they will attend. */
  requires_presence: boolean;
  /** Shared by the events of a recurring meeting. */
  series_id?: string | null;
};

/** An event together with the association that organises it. */
export type EventWithAssociation = AssociationEvent & {
  association_id: string;
  association: { name: string } | null;
};

export const EVENT_WITH_ASSOCIATION_COLUMNS =
  'id, title, description, location, starts_at, ends_at, audience, requires_presence, association_id, association:associations(name)';

export const restrictionOf = (event: Pick<AssociationEvent, 'audience'>) =>
  AUDIENCES.find((option) => option.value === event.audience)?.restriction ?? null;

/** Who an event is addressed to, in the order shown when creating one. */
export const AUDIENCES: { value: EventAudience; label: string; restriction: string | null }[] = [
  { value: 'everyone', label: 'Tout le monde', restriction: null },
  { value: 'members', label: 'Membres actifs', restriction: 'Réservé aux membres actifs' },
  { value: 'committee', label: 'Comité', restriction: 'Réservé au comité' },
];

const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const formatDay = (date: Date) => DAY.format(date);
export const formatTime = (date: Date) => TIME.format(date);

/** "samedi 12 octobre · 14:00 – 16:00" */
export function formatEventDate(event: Pick<AssociationEvent, 'starts_at' | 'ends_at'>) {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? ` – ${formatTime(new Date(event.ends_at))}` : '';
  return `${formatDay(start)} · ${formatTime(start)}${end}`;
}

/** The day of `day` at the time of `time`. */
export function atTimeOf(day: Date, time: Date) {
  const result = new Date(day);
  result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
}

/** 'custom' patterns are planned; only weekly series exist for now. */
export type Recurrence = 'none' | 'weekly';

/** A series lasts one year at most. */
export function oneYearAfter(date: Date) {
  return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate());
}

/**
 * Start of every event of a series, from `start` to the end of the `until` day.
 * Dates are built in local time, so the hour stays the same across clock changes.
 */
export function occurrences(start: Date, recurrence: Recurrence, until: Date) {
  if (recurrence === 'none') return [start];
  const limit = new Date(Math.min(until.getTime(), oneYearAfter(start).getTime()));
  limit.setHours(23, 59, 59, 999);

  const dates: Date[] = [];
  for (let week = 0; ; week++) {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + week * 7,
      start.getHours(),
      start.getMinutes()
    );
    if (date > limit) break;
    dates.push(date);
  }
  return dates;
}

/** What to tell someone whose event could not be saved or deleted. */
export function eventWriteError(error: { code?: string; message: string }) {
  return error.code === '42501'
    ? 'Seuls les responsables et les membres du comité peuvent gérer les événements.'
    : error.message;
}

export type Presence = 'present' | 'absent';

export const PRESENCES: { value: Presence; label: string; answer: string }[] = [
  { value: 'present', label: 'Présent', answer: 'Je serai présent' },
  { value: 'absent', label: 'Absent', answer: 'Je serai absent' },
];

/** What to show next to an event that asks for a presence declaration. */
export function presenceLabel(presence: Presence | undefined) {
  return presence
    ? `Vous avez répondu : ${PRESENCES.find((option) => option.value === presence)!.label.toLowerCase()}`
    : 'Présence à déclarer';
}
