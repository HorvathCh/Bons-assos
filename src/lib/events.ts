export type AssociationEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
};

const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** "samedi 12 octobre · 14:00 – 16:00" */
export function formatEventDate(event: Pick<AssociationEvent, 'starts_at' | 'ends_at'>) {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? ` – ${TIME.format(new Date(event.ends_at))}` : '';
  return `${DAY.format(start)} · ${TIME.format(start)}${end}`;
}

/** Reads "JJ/MM/AAAA" and "HH:MM" as a local date. Returns null when they are not a real date. */
export function parseDateTime(date: string, time: string) {
  const day = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date.trim());
  const clock = /^(\d{1,2})[:h](\d{2})$/.exec(time.trim());
  if (!day || !clock) return null;
  const [d, m, y] = day.slice(1).map(Number);
  const [hours, minutes] = clock.slice(1).map(Number);
  const result = new Date(y, m - 1, d, hours, minutes);
  // Rejects overflows such as 31/02 or 25:00, which Date would silently roll over.
  const exact =
    result.getFullYear() === y &&
    result.getMonth() === m - 1 &&
    result.getDate() === d &&
    result.getHours() === hours &&
    result.getMinutes() === minutes;
  return exact ? result : null;
}
