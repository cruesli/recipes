// Total cook time for a recipe: prefer an explicit totalTimeMinutes, else
// sum whatever prep/cook components are present. Most recipes carry
// prep + cook rather than a single total.
export function deriveTotalTime({ totalTimeMinutes, prepTimeMinutes, cookTimeMinutes } = {}) {
  if (totalTimeMinutes != null) return totalTimeMinutes;
  if (prepTimeMinutes != null || cookTimeMinutes != null) {
    return (prepTimeMinutes ?? 0) + (cookTimeMinutes ?? 0);
  }
  return null;
}

// Work-back schedule: minutes-of-day for "on the table at" → "start by".
// Marinade is do-ahead time before the active prep+cook block. Negative
// values mean "the day before" — formatting/labelling is the caller's job.
export function workBack(targetMinutes, { prepTimeMinutes, cookTimeMinutes, marinadeTimeMinutes } = {}) {
  const active = (prepTimeMinutes ?? 0) + (cookTimeMinutes ?? 0);
  if (targetMinutes == null || active <= 0) return null;
  const startBy = targetMinutes - active;
  return {
    startBy,
    marinadeFrom: marinadeTimeMinutes ? startBy - marinadeTimeMinutes : null,
  };
}

export function formatClock(minutes) {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}
