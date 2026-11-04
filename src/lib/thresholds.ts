/**
 * Utilisation levels shared by every meter in the app.
 *
 * Colours follow the reference mockup: healthy usage is green, high usage is
 * orange (the brand accent) and critical usage is red. Text labels always
 * accompany the colour so state is never communicated by colour alone.
 */
export type UsageLevel = "ok" | "high" | "critical";

export const USAGE_THRESHOLDS = {
  high: 70,
  critical: 90,
} as const;

export function usageLevel(percent: number | null | undefined): UsageLevel {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return "ok";
  if (percent >= USAGE_THRESHOLDS.critical) return "critical";
  if (percent >= USAGE_THRESHOLDS.high) return "high";
  return "ok";
}

export const TEMPERATURE_THRESHOLDS = { high: 80, critical: 90 } as const;

export function temperatureLevel(celsius: number | null | undefined): UsageLevel {
  if (celsius === null || celsius === undefined || !Number.isFinite(celsius)) return "ok";
  if (celsius >= TEMPERATURE_THRESHOLDS.critical) return "critical";
  if (celsius >= TEMPERATURE_THRESHOLDS.high) return "high";
  return "ok";
}

/** Tailwind colour utilities per level (tokens only). */
export const LEVEL_TEXT: Record<UsageLevel, string> = {
  ok: "text-success",
  high: "text-primary",
  critical: "text-danger",
};

export const LEVEL_BG: Record<UsageLevel, string> = {
  ok: "bg-success",
  high: "bg-primary",
  critical: "bg-danger",
};

/** Number of lit cells in a segmented meter. */
export function litSegments(percent: number | null | undefined, segments = 10): number {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return 0;
  const clamped = Math.min(100, Math.max(0, percent));
  if (clamped === 0) return 0;
  return Math.max(1, Math.min(segments, Math.round((clamped / 100) * segments)));
}
