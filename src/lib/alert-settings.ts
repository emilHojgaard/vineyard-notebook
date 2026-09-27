export const ALERT_DAYS_MIN = 0;
export const ALERT_DAYS_MAX = 365;

function clampAlertDays(value: number): number {
  return Math.min(ALERT_DAYS_MAX, Math.max(ALERT_DAYS_MIN, value));
}

/**
 * Convert an alert-days field to a safe, whole-day value.
 *
 * The input is intentionally kept as text while it is being edited so that
 * an empty field can exist briefly. Empty and otherwise invalid values fall
 * back to the last saved value; values outside the supported range are
 * clamped before they are saved.
 */
export function normalizeAlertDays(value: string, fallback: number): number {
  const safeFallback = Number.isInteger(fallback)
    ? clampAlertDays(fallback)
    : ALERT_DAYS_MIN;
  const trimmed = value.trim();

  if (trimmed === '') return safeFallback;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return safeFallback;

  return clampAlertDays(parsed);
}
