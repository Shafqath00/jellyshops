import { useEffect, useState } from "react";

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/;

/** Minutes London is ahead of UTC at `instant` (0 in winter, 60 in summer). */
function londonOffsetMinutes(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - Math.floor(instant / 60_000) * 60_000) / 60_000);
}

/** "2026-12-01 18:00" in UK time as a timestamp, or null when the text is not a date. Midnight when no time is given. */
export function countdownTarget(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = PATTERN.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00"] = match;
  const guess = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (Number.isNaN(guess)) return null;
  // Correct by the offset at the guessed moment, then once more in case the guess crossed a clock change.
  const first = guess - londonOffsetMinutes(guess) * 60_000;
  return guess - londonOffsetMinutes(first) * 60_000;
}

export function countdownParts(remaining: number): { days: number; hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor(remaining / 1000));
  return { days: Math.floor(total / 86_400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}

const units = [["days", "days"], ["hours", "hours"], ["minutes", "mins"], ["seconds", "secs"]] as const;

/**
 * Counts down to `target`. Nothing time-dependent is drawn on the server, so the page hydrates cleanly;
 * the numbers appear once the browser has the time. Screen readers get a summary to the minute instead of
 * a number that changes every second.
 */
export function HeroCountdown({ target, endText, now: fixedNow }: { target: number; endText?: string; now?: number }) {
  const [ticking, setNow] = useState<number | null>(null);
  const now = fixedNow ?? ticking;
  useEffect(() => {
    if (fixedNow !== undefined) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [fixedNow]);
  if (now === null) return <div className="jelly-hero-countdown" data-state="waiting" aria-hidden="true" />;
  if (now >= target) return endText ? <p className="jelly-hero-countdown-done">{endText}</p> : null;
  const parts = countdownParts(target - now);
  const summary = `Starts in ${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes`;
  return <div className="jelly-hero-countdown" role="timer" aria-label={summary}>
    {units.map(([key, label]) => <span key={key} className="jelly-hero-countdown-unit" aria-hidden="true">
      <strong>{String(parts[key]).padStart(2, "0")}</strong>
      <small>{label}</small>
    </span>)}
  </div>;
}
