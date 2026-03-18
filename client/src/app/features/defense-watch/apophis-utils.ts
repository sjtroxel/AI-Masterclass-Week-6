// Pure countdown logic — extracted for unit testability.

export interface Countdown {
  days:    number;
  hours:   number;
  minutes: number;
  seconds: number;
  past:    boolean;
}

// April 13, 2029 00:00 UTC — the Apophis flyby date
export const APOPHIS_FLYBY_MS = new Date('2029-04-13T00:00:00Z').getTime();

export function buildCountdown(now: number): Countdown {
  const diff = APOPHIS_FLYBY_MS - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000)  /    60_000),
    seconds: Math.floor((diff %    60_000)  /     1_000),
    past:    false,
  };
}
