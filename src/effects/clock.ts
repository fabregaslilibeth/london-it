/** Wall-clock time in a time zone, for the clock face and the "London 14:32:05" label. */
export function createZoneClock(timeZone: string): { seconds(): number } {
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  let offset = 0;
  let measuredAt = -Infinity;

  const measure = (now: number) => {
    const part: Record<string, number> = {};
    for (const p of format.formatToParts(now)) part[p.type] = Number(p.value);
    const wall = Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute, part.second);
    offset = wall - (now - (now % 1000));
    measuredAt = now;
  };

  return {
    /** Seconds since midnight in the zone, with a fractional part. */
    seconds() {
      const now = Date.now();
      // Once a minute is plenty to catch the switch between GMT and BST.
      if (now - measuredAt > 60_000) measure(now);
      return ((((now + offset) / 1000) % 86400) + 86400) % 86400;
    },
  };
}
