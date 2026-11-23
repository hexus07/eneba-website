/** Pages to show: first, last, current ±1, with gaps marked as null. 1 … 4 5 6 … 20 */
export function pageWindow(page: number, lastPage: number): (number | null)[] {
  const pages = new Set([1, lastPage, page - 1, page, page + 1].filter((p) => p >= 1 && p <= lastPage));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => {
    const prev = sorted[i - 1];
    if (prev === undefined || p - prev === 1) return [p];
    return p - prev === 2 ? [prev + 1, p] : [null, p];
  });
}
