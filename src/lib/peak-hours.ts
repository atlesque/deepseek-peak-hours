/**
 * DeepSeek API pricing-window time utilities.
 *
 * Peak rates apply Monday through Friday during 01:00–04:00 and
 * 06:00–10:00 UTC. All other times are off-peak, at half the peak rate.
 */

const MINUTES_PER_DAY = 24 * 60;
const DAYS_PER_WEEK = 7;
const FIRST_PEAK_START = 1 * 60;
const FIRST_PEAK_END = 4 * 60;
const SECOND_PEAK_START = 6 * 60;
const SECOND_PEAK_END = 10 * 60;
const WEEKDAY_START = 1; // Monday in Date#getUTCDay()
const WEEKDAY_END = 5; // Friday in Date#getUTCDay()

const PEAK_WINDOWS = [
  { start: FIRST_PEAK_START, end: FIRST_PEAK_END },
  { start: SECOND_PEAK_START, end: SECOND_PEAK_END },
] as const;

/** Off-peak rates are 50% of peak rates. */
export const OFF_PEAK_RATE_MULTIPLIER = 0.5;

/* ── Timezone override (localStorage) ─────────────────────────────────── */

const TZ_STORAGE_KEY = "deepseek-peak-hours:tz";

/** Get the user's manually selected IANA timezone, or null if auto-detect. */
export function getStoredTimezone(): string | null {
  try {
    return localStorage.getItem(TZ_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Store a manual timezone override. Pass null to revert to auto-detect. */
export function setStoredTimezone(tz: string | null): void {
  try {
    if (tz) {
      localStorage.setItem(TZ_STORAGE_KEY, tz);
    } else {
      localStorage.removeItem(TZ_STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/** Resolve the effective IANA timezone (manual override or browser default). */
export function getUserTimezone(): string {
  return (
    getStoredTimezone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}

/**
 * Compute the UTC offset (minutes) for a given IANA timezone at the
 * current instant. Positive = ahead of UTC (east).
 */
export function getOffsetForZone(zone: string): number {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "longOffset",
  }).formatToParts(now);

  const tzPart = parts.find((p) => p.type === "timeZoneName");
  if (tzPart) {
    // Expected format: "GMT-05:00", "GMT+08:00", "GMT+05:30", or "GMT"
    const match = tzPart.value.match(/^GMT([+-])(\d{2}):(\d{2})$/);
    if (match) {
      const sign = match[1] === "+" ? 1 : -1;
      const hours = parseInt(match[2], 10);
      const minutes = parseInt(match[3], 10);
      return sign * (hours * 60 + minutes);
    }
    if (tzPart.value === "GMT") {
      return 0;
    }
  }

  // Fallback (shouldn't normally be reached)
  return -now.getTimezoneOffset();
}

/** The user's effective UTC offset in minutes. */
export function getUserOffsetMinutes(): number {
  return getOffsetForZone(getUserTimezone());
}

/* ── UTC schedule helpers ─────────────────────────────────────────────── */

interface UtcDateParts {
  day: number;
  minutes: number;
}

function getUtcDateParts(date: Date): UtcDateParts {
  return {
    day: date.getUTCDay(),
    minutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
  };
}

function isWeekday(day: number): boolean {
  return day >= WEEKDAY_START && day <= WEEKDAY_END;
}

function isPeakAt(date: Date): boolean {
  const { day, minutes } = getUtcDateParts(date);
  return (
    isWeekday(day) &&
    PEAK_WINDOWS.some(({ start, end }) => minutes >= start && minutes < end)
  );
}

/** Is the given instant within a peak-rate window in UTC? */
export function isPeakHoursInUtc(date = new Date()): boolean {
  return isPeakAt(date);
}

/** Is it currently within a peak-rate window in UTC? */
export function isPeakHours(): boolean {
  return isPeakAt(new Date());
}

/** Return the rate multiplier for the given instant: 1 for peak, 0.5 off-peak. */
export function getRateMultiplier(date = new Date()): number {
  return isPeakAt(date) ? 1 : OFF_PEAK_RATE_MULTIPLIER;
}

/* ── Formatted time strings ───────────────────────────────────────────── */

/** Formatted UTC time string (HH:MM:SS, 24h). */
export function getUtcTimeString(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Formatted local time string, respecting the manual timezone override. */
export function getLocalTimeString(): string {
  const zone = getStoredTimezone();
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  if (zone) options.timeZone = zone;
  return new Date().toLocaleTimeString("en-US", options);
}

/** Human-readable timezone info (respects override). */
export function getLocalTZString(): string {
  const offset = getUserOffsetMinutes();
  const zone = getUserTimezone();
  const sign = offset >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const m = String(Math.abs(offset) % 60).padStart(2, "0");
  return `Your timezone: UTC${sign}${h}:${m} (${zone})`;
}

function formatMinutes(minutes: number): string {
  if (minutes === MINUTES_PER_DAY) return "24:00";
  const normalized =
    ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Peak windows converted to the user's effective timezone. */
export function getLocalPeakHoursString(): string {
  const offset = getUserOffsetMinutes();
  const sign = offset >= 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const offsetLabel =
    minutes === 0
      ? `UTC${sign}${hours}`
      : `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`;
  const toLocal = (minutes: number): string => formatMinutes(minutes + offset);

  return `Peak in your time: ${toLocal(FIRST_PEAK_START)}-${toLocal(FIRST_PEAK_END)} • ${toLocal(SECOND_PEAK_START)}-${toLocal(SECOND_PEAK_END)} ${offsetLabel}`;
}

/* ── Countdown ─────────────────────────────────────────────────────────── */

export interface CountdownInfo {
  /** "peak" if we're heading toward peak hours, "off" if heading toward off hours */
  nextState: "peak" | "off";
  /** Total seconds until the next transition */
  secondsUntil: number;
}

function getUtcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function getTransitionTime(now: Date): Date {
  const { minutes } = getUtcDateParts(now);

  for (const { start, end } of PEAK_WINDOWS) {
    if (minutes >= start && minutes < end) {
      const dayStart = getUtcDayStart(now);
      return new Date(dayStart.getTime() + end * 60 * 1000);
    }
  }

  const dayStart = getUtcDayStart(now);
  for (let dayOffset = 0; dayOffset <= DAYS_PER_WEEK; dayOffset += 1) {
    const candidateDay = new Date(dayStart);
    candidateDay.setUTCDate(candidateDay.getUTCDate() + dayOffset);

    if (!isWeekday(candidateDay.getUTCDay())) continue;

    for (const { start } of PEAK_WINDOWS) {
      const candidate = new Date(candidateDay.getTime() + start * 60 * 1000);
      if (candidate.getTime() > now.getTime()) return candidate;
    }
  }

  throw new Error("Unable to find the next peak-rate window");
}

/** Calculate the time until the next peak/off-peak transition in UTC. */
export function getCountdownInfo(now = new Date()): CountdownInfo {
  const peak = isPeakAt(now);
  const transition = getTransitionTime(now);

  return {
    nextState: peak ? "off" : "peak",
    secondsUntil: Math.max(
      0,
      Math.ceil((transition.getTime() - now.getTime()) / 1000),
    ),
  };
}

/** Format seconds as HH:MM:SS (always shown). */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
