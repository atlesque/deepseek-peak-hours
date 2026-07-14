/**
 * DeepSeek API peak-hours time utilities.
 *
 * Peak hours (Beijing time, UTC+8):
 *   - Morning: 09:00–12:00  (540–720 min)
 *   - Afternoon: 14:00–18:00  (840–1080 min)
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
 */
export function getOffsetForZone(zone: string): number {
  const now = new Date();
  const utcMs = now.getTime();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  // Treat the zoned calendar date/time as UTC — the difference from
  // actual UTC gives the offset.
  const fakeUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );

  return Math.round((fakeUtcMs - utcMs) / 60_000);
}

/**
 * The user's effective UTC offset in minutes.  Uses the manual override
 * if set, otherwise falls back to the browser's timezone.
 */
export function getUserOffsetMinutes(): number {
  const zone = getUserTimezone();
  return zone === Intl.DateTimeFormat().resolvedOptions().timeZone
    ? -new Date().getTimezoneOffset()
    : getOffsetForZone(zone);
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

/** Is it currently peak hours in Beijing? */
export function isPeakHoursInBeijing(): boolean {
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

  return `Peak in your time: ${toLocal(utcMorningStart)}–${toLocal(utcMorningEnd)} · ${toLocal(utcAfternoonStart)}–${toLocal(utcAfternoonEnd)}`;
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
  // 18:00–24:00 → heading to next day morning peak
  return {
    nextState: "peak",
    secondsUntil:
      (24 * 60 - total + MORNING_START) * 60 - new Date().getSeconds(),
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
