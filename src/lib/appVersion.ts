/**
 * Compares dot-separated numeric version strings (e.g. "1.1" vs "1.2"). Returns negative when
 * `a` is older than `b`, zero when equal, positive when newer. Missing trailing segments count
 * as 0 (so "1" == "1.0").
 */
export function compareVersions(a: string, b: string): number {
  const as = a.split('.').map((n) => parseInt(n, 10) || 0);
  const bs = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const diff = (as[i] ?? 0) - (bs[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
