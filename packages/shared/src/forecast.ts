export interface ConsumableReadingPoint {
  levelPercent: number | null;
  collectedAt: Date;
}

export interface SupplyForecast {
  currentLevelPercent: number;
  dailyDepletionRate: number; // percentage points consumed per day
  daysRemaining: number;
  predictedReplacementAt: Date;
  dataPoints: number;
}

/**
 * Predicts when a printer consumable (toner/drum/etc.) will need replacing,
 * based on its own recent depletion rate rather than a fixed threshold.
 *
 * Only the most recent unbroken decreasing run is used: a level increase
 * means the part was physically replaced (see ConsumableReplacement), so
 * readings from before that point belong to the previous unit and would
 * corrupt the rate. Returns null when there isn't enough of a trend to
 * predict from (fewer than 2 usable points, or level isn't actually
 * decreasing).
 */
export function calculateSupplyForecast(readings: ConsumableReadingPoint[], now: Date = new Date()): SupplyForecast | null {
  const sorted = readings
    .filter((r) => r.levelPercent !== null)
    .map((r) => ({ levelPercent: r.levelPercent as number, collectedAt: r.collectedAt }))
    .sort((a, b) => a.collectedAt.getTime() - b.collectedAt.getTime());

  if (sorted.length === 0) return null;

  // Walk backward from the latest reading, keeping only the trailing run
  // where level is non-increasing (allow equal readings between polls).
  const latest = sorted[sorted.length - 1];
  const run: typeof sorted = [latest];
  for (let i = sorted.length - 2; i >= 0; i--) {
    const candidate = sorted[i];
    if (candidate.levelPercent < run[0].levelPercent) break;
    run.unshift(candidate);
  }

  if (run.length < 2) return null;

  const first = run[0];
  const last = run[run.length - 1];
  const elapsedDays = (last.collectedAt.getTime() - first.collectedAt.getTime()) / (1000 * 60 * 60 * 24);
  const levelDrop = first.levelPercent - last.levelPercent;

  if (elapsedDays <= 0 || levelDrop <= 0) return null;

  const dailyDepletionRate = levelDrop / elapsedDays;
  const daysRemaining = last.levelPercent / dailyDepletionRate;
  const predictedReplacementAt = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);

  return {
    currentLevelPercent: last.levelPercent,
    dailyDepletionRate,
    daysRemaining,
    predictedReplacementAt,
    dataPoints: run.length,
  };
}
