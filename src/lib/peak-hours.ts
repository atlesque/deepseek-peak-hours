/**
 * DeepSeek API peak-hours time utilities.
 *
 * Peak hours (Beijing time, UTC+8), Monday to Friday only:
 *   - Morning: 09:00–12:00  (540–720 min)
 *   - Afternoon: 14:00–18:00  (840–1080 min)
 *
 * Saturday and Sunday are off-peak all day (since 2026-08-23).
 */

const MORNING_START = 9 * 60; // 540
const MORNING_END = 12 * 60; // 720
const AFTERNOON_START = 14 * 60; // 840
const AFTERNOON_END = 18 * 60; // 1080

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
 * current instant.  Positive = ahead of UTC (east).
 *
 * Uses the "longOffset" timeZoneName which returns the offset directly
 * (e.g. "GMT-05:00"), avoiding the date-crossing pitfall of the old
 * Date.UTC-based approach that produced wrong results when the target
 * zone's calendar date differed from the UTC date.
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
    // UTC itself may be rendered as just "GMT"
    if (tzPart.value === "GMT") {
      return 0;
    }
  }

  // Fallback (shouldn't normally be reached)
  return -now.getTimezoneOffset();
}

/**
 * The user's effective UTC offset in minutes.  Uses the manual override
 * if set, otherwise falls back to the browser's timezone.
 */
export function getUserOffsetMinutes(): number {
  return getOffsetForZone(getUserTimezone());
}

/* ── Beijing time helpers ─────────────────────────────────────────────── */

/** Return the current time in Beijing as total minutes since midnight. */
function beijingMinutesNow(): number {
  const now = new Date();
  // Use Intl for reliable Beijing time extraction
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Return the current day of the week in Beijing.  0 = Sunday … 6 = Saturday.
 *
 * The weekday has to come off the Beijing calendar, not the local or the UTC
 * one.  The Chinese pricing page states it in Beijing time (北京时间周一至周五),
 * and a UTC weekday disagrees with a Beijing weekday for sixteen hours every
 * week — Friday and Sunday, 16:00–24:00 UTC.
 */
function beijingWeekdayNow(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).formatToParts(new Date());

  const w = parts.find((p) => p.type === "weekday")?.value ?? "";
  // Unknown value → treat as a weekday, i.e. keep the hour windows in play
  // rather than silently declaring the whole day off-peak.
  return WEEKDAY_INDEX[w] ?? 1;
}

/** Is it currently the weekend in Beijing?  Weekends are off-peak all day. */
function isBeijingWeekend(): boolean {
  const day = beijingWeekdayNow();
  return day === 0 || day === 6;
}

/** Is it currently peak hours in Beijing? */
export function isPeakHoursInBeijing(): boolean {
  if (isBeijingWeekend()) {
    return false;
  }
  const total = beijingMinutesNow();
  return (
    (total >= MORNING_START && total < MORNING_END) ||
    (total >= AFTERNOON_START && total < AFTERNOON_END)
  );
}

/* ── Formatted time strings ───────────────────────────────────────────── */

/** Formatted Beijing time string (HH:MM:SS, 24h). */
export function getBeijingTimeString(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: "Asia/Shanghai",
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

/** Peak hours converted to the user's effective timezone. */
export function getLocalPeakHoursString(): string {
  // Beijing peak hours in UTC minutes since midnight:
  // 09:00 BJ = 01:00 UTC = 60 min, 12:00 BJ = 04:00 UTC = 240 min
  // 14:00 BJ = 06:00 UTC = 360 min, 18:00 BJ = 10:00 UTC = 600 min
  const utcMorningStart = 60;
  const utcMorningEnd = 240;
  const utcAfternoonStart = 360;
  const utcAfternoonEnd = 600;

  const offset = getUserOffsetMinutes();

  const toLocal = (utcMin: number): string => {
    let local = (utcMin + offset) % (24 * 60);
    if (local < 0) local += 24 * 60;
    const hh = String(Math.floor(local / 60)).padStart(2, "0");
    const mm = String(local % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // The days stay Beijing days on purpose: west of UTC+1, Beijing Monday
  // 09:00 falls on the user's Sunday evening, so "Mon–Fri" would be wrong
  // if it were read as local days.
  return `Peak in your time: ${toLocal(utcMorningStart)}–${toLocal(utcMorningEnd)} · ${toLocal(utcAfternoonStart)}–${toLocal(utcAfternoonEnd)} (Beijing Mon–Fri)`;
}

/* ── Countdown ─────────────────────────────────────────────────────────── */

export interface CountdownInfo {
  /** "peak" if we're heading toward peak hours, "off" if heading toward off hours */
  nextState: "peak" | "off";
  /** Total seconds until the next transition */
  secondsUntil: number;
}

/**
 * Calculate how long until the next peak / off transition in Beijing time.
 * Returns the target state and total seconds remaining.
 */
export function getCountdownInfo(): CountdownInfo {
  const total = beijingMinutesNow();
  const day = beijingWeekdayNow();

  /** Minutes from now until 09:00 Beijing, `days` days from today. */
  const untilMorningPeakIn = (days: number): number =>
    days * 24 * 60 - total + MORNING_START;

  if (day === 6 || day === 0) {
    // Saturday / Sunday → off-peak all day, next peak is Monday morning.
    return {
      nextState: "peak",
      secondsUntil:
        untilMorningPeakIn(day === 6 ? 2 : 1) * 60 - new Date().getSeconds(),
    };
  }

  if (total < MORNING_START) {
    // 00:00–09:00 → heading to morning peak
    return {
      nextState: "peak",
      secondsUntil: (MORNING_START - total) * 60 - new Date().getSeconds(),
    };
  }
  if (total < MORNING_END) {
    // 09:00–12:00 → heading to first off period
    return {
      nextState: "off",
      secondsUntil: (MORNING_END - total) * 60 - new Date().getSeconds(),
    };
  }
  if (total < AFTERNOON_START) {
    // 12:00–14:00 → heading to afternoon peak
    return {
      nextState: "peak",
      secondsUntil: (AFTERNOON_START - total) * 60 - new Date().getSeconds(),
    };
  }
  if (total < AFTERNOON_END) {
    // 14:00–18:00 → heading to off hours
    return {
      nextState: "off",
      secondsUntil: (AFTERNOON_END - total) * 60 - new Date().getSeconds(),
    };
  }
  // 18:00–24:00 → heading to the next weekday's morning peak.  On a Friday
  // evening that is three days out, not one.
  return {
    nextState: "peak",
    secondsUntil:
      untilMorningPeakIn(day === 5 ? 3 : 1) * 60 - new Date().getSeconds(),
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
