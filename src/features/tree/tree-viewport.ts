/**
 * Return the scroll offset that centers a horizontally scrollable canvas.
 * A canvas narrower than its viewport has no scroll range and stays centered
 * by its normal auto margins, so its offset is zero.
 */
export function getCenteredScrollLeft(scrollWidth: number, viewportWidth: number): number {
  if (!Number.isFinite(scrollWidth) || !Number.isFinite(viewportWidth)) return 0;
  return Math.max(0, (scrollWidth - viewportWidth) / 2);
}

/** Keep a saved or measured scroll offset inside the current scroll range. */
export function clampScrollLeft(scrollLeft: number, scrollWidth: number, viewportWidth: number): number {
  const maxScrollLeft = Math.max(0, scrollWidth - viewportWidth);
  return Math.min(maxScrollLeft, Math.max(0, scrollLeft));
}
