export const TAP_TEMPO_TIMEOUT_MS = 2000;
const MAX_TAPS = 6;

export function normalizeTapHistory(history: number[], nowMs: number): number[] {
  const filtered = history.filter((timestamp) => nowMs - timestamp <= TAP_TEMPO_TIMEOUT_MS);
  const withCurrent = [...filtered, nowMs];
  return withCurrent.slice(-MAX_TAPS);
}

export function calculateTapTempo(history: number[]): number | null {
  if (history.length < 2) {
    return null;
  }

  const intervals: number[] = [];
  for (let index = 1; index < history.length; index += 1) {
    const interval = history[index] - history[index - 1];
    if (interval <= 0) {
      continue;
    }
    intervals.push(interval);
  }

  if (intervals.length === 0) {
    return null;
  }

  const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  return Math.round(60000 / averageInterval);
}
