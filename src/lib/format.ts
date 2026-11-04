import type { Language } from "@/types/ipc";

const BINARY_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
const RATE_UNITS = ["B/s", "kB/s", "MB/s", "GB/s"] as const;

function nf(locale: Language, maximumFractionDigits: number, minimumFractionDigits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits, minimumFractionDigits });
}

export interface FormatBytesOptions {
  /** Max fraction digits when the value is below 10 units (default 2). */
  precision?: number;
  /** Force a unit index (0 = B, 1 = KB, ...). */
  unitIndex?: number;
}

/** Split bytes into a scaled value + binary unit (1024-based, like Windows). */
export function scaleBytes(bytes: number, unitIndex?: number): { value: number; unit: string } {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  let idx = 0;
  let value = safe;
  if (unitIndex !== undefined) {
    idx = Math.max(0, Math.min(unitIndex, BINARY_UNITS.length - 1));
    value = safe / 1024 ** idx;
  } else {
    while (value >= 1024 && idx < BINARY_UNITS.length - 1) {
      value /= 1024;
      idx += 1;
    }
  }
  return { value, unit: BINARY_UNITS[idx] ?? "B" };
}

/** "162,03 GB" (pt-BR) / "162.03 GB" (en-US). */
export function formatBytes(
  bytes: number,
  locale: Language = "pt-BR",
  options: FormatBytesOptions = {},
): string {
  const { value, unit } = scaleBytes(bytes, options.unitIndex);
  const precision = options.precision ?? 2;
  // Like the reference mockup: "162,03 GB", "482,7 MB", "512 KB".
  const digits = unit === "B" || unit === "KB" ? 0 : unit === "MB" ? 1 : precision;
  return `${nf(locale, digits).format(value)} ${unit}`;
}

/** Whole-unit label for capacities, e.g. "1 TB", "24 GB", "512 GB". */
export function formatCapacity(bytes: number, locale: Language = "pt-BR"): string {
  const { value, unit } = scaleBytes(bytes);
  const digits = value >= 10 || Number.isInteger(value) ? 0 : 1;
  return `${nf(locale, digits).format(value)} ${unit}`;
}

/** "230 kB/s" (decimal, like the mockup). */
export function formatRate(bytesPerSecond: number, locale: Language = "pt-BR"): string {
  const safe = Number.isFinite(bytesPerSecond) && bytesPerSecond > 0 ? bytesPerSecond : 0;
  let idx = 0;
  let value = safe;
  while (value >= 1000 && idx < RATE_UNITS.length - 1) {
    value /= 1000;
    idx += 1;
  }
  const digits = idx === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${nf(locale, digits).format(value)} ${RATE_UNITS[idx] ?? "B/s"}`;
}

/** "22%" / "66,5%". */
export function formatPercent(
  value: number | null | undefined,
  locale: Language = "pt-BR",
  digits = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const clamped = Math.min(100, Math.max(0, value));
  return `${nf(locale, digits).format(clamped)}%`;
}

/** "56°C". */
export function formatTemperature(value: number | null | undefined, locale: Language = "pt-BR") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${nf(locale, 0).format(value)}°C`;
}

export interface UptimeParts {
  days: number;
  hours: number;
  minutes: number;
}

export function splitUptime(seconds: number): UptimeParts {
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86_400);
  const hours = Math.floor((safe % 86_400) / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  return { days, hours, minutes };
}

/** "5H 23M" / "2D 4H" — the compact dashboard renders it after "UP". */
export function formatUptimeShort(seconds: number): string {
  const { days, hours, minutes } = splitUptime(seconds);
  if (days > 0) return `${days}D ${hours}H`;
  return `${hours}H ${minutes}M`;
}

/** "2 d 4 h 10 min". */
export function formatUptimeLong(seconds: number, locale: Language = "pt-BR"): string {
  const { days, hours, minutes } = splitUptime(seconds);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} d`);
  if (hours > 0 || days > 0) parts.push(`${hours} h`);
  parts.push(`${minutes} ${locale === "en-US" ? "min" : "min"}`);
  return parts.join(" ");
}

export function formatInteger(value: number, locale: Language = "pt-BR"): string {
  return nf(locale, 0).format(Math.round(value));
}

export function formatDuration(ms: number, locale: Language = "pt-BR"): string {
  if (ms < 1000) return `${formatInteger(ms, locale)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${nf(locale, 1).format(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes} min ${rest} s`;
}

export function formatFrequency(mhz: number, locale: Language = "pt-BR"): string {
  if (!mhz) return "—";
  if (mhz >= 1000) return `${nf(locale, 2).format(mhz / 1000)} GHz`;
  return `${formatInteger(mhz, locale)} MHz`;
}

export function formatDate(ms: number | null, locale: Language = "pt-BR"): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
    new Date(ms),
  );
}

/** Shorten long Windows paths for display: keeps the drive and last 2 segments. */
export function shortenPath(path: string, maxLength = 60): string {
  if (path.length <= maxLength) return path;
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 3) return path;
  const head = parts[0] ?? "";
  const tail = parts.slice(-2).join("\\");
  return `${head}\\…\\${tail}`;
}
