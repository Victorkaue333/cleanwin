/** Fixed-size series used by the sparklines. Oldest value first. */
export function pushHistory(history: readonly number[], value: number, size = 60): number[] {
  const safe = Number.isFinite(value) ? value : 0;
  const next = history.length >= size ? history.slice(history.length - size + 1) : history.slice();
  next.push(safe);
  return next;
}

export function historyMax(history: readonly number[], floor = 0): number {
  let max = floor;
  for (const v of history) if (v > max) max = v;
  return max;
}

/** Build an SVG polyline `points` string for a series inside a w×h box. */
export function sparklinePoints(
  history: readonly number[],
  width: number,
  height: number,
  max: number,
  padding = 1,
): string {
  if (history.length === 0) return "";
  const innerH = Math.max(1, height - padding * 2);
  const innerW = Math.max(1, width - padding * 2);
  const denominator = max > 0 ? max : 1;
  const step = history.length > 1 ? innerW / (history.length - 1) : 0;
  return history
    .map((v, i) => {
      const x = padding + i * step;
      const y = padding + innerH - (Math.min(v, denominator) / denominator) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
