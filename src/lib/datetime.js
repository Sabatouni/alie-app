// `<input type="datetime-local">` speaks local wall-clock time; Postgres
// timestamptz columns come back as UTC ISO strings. The admin used to do
// `row.target_at.slice(0, 16)`, which pushed the UTC value straight into a local
// input — so opening an event or countdown for editing and saving it again
// shifted the time by the timezone offset, every single time.

export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local wall-clock string from a datetime-local input → UTC ISO for Postgres. */
export function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
