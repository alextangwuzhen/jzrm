export type DiffSegment = { type: 'same' | 'del' | 'ins'; text: string };

const MAX_DIFF = 4000;

/** 字符级 LCS 差异，用于"去AI味"前后改动高亮；超出上限返回空（提示文本过大）。 */
export function diffChars(a: string, b: string): DiffSegment[] {
  const m = a.length, n = b.length;
  if (m * n > MAX_DIFF * MAX_DIFF) return [];
  const dp = new Int32Array((m + 1) * (n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i * (n + 1) + j] = a[i] === b[j] ? dp[(i + 1) * (n + 1) + j + 1] + 1 : Math.max(dp[(i + 1) * (n + 1) + j], dp[i * (n + 1) + j + 1]);
    }
  }
  const segs: DiffSegment[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { segs.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (dp[(i + 1) * (n + 1) + j] >= dp[i * (n + 1) + j + 1]) { segs.push({ type: 'del', text: a[i] }); i++; }
    else { segs.push({ type: 'ins', text: b[j] }); j++; }
  }
  while (i < m) segs.push({ type: 'del', text: a[i++] });
  while (j < n) segs.push({ type: 'ins', text: b[j++] });
  const merged: DiffSegment[] = [];
  for (const s of segs) { const last = merged[merged.length - 1]; if (last && last.type === s.type) last.text += s.text; else merged.push({ type: s.type, text: s.text }); }
  return merged;
}
