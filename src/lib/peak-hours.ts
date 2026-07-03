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

/** Human-readable local timezone info. */
export function getLocalTZString(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const m = String(Math.abs(offset) % 60).padStart(2, "0");
  return `Your timezone: ${tz} (UTC${sign}${h}:${m})`;
}
