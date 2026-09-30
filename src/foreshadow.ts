export const foreshadowStatuses = ['埋设', '揭示', '废弃'] as const;
export type ForeshadowStatus = typeof foreshadowStatuses[number];

export function readForeshadowStatus(meta: Record<string, unknown>): ForeshadowStatus {
  const value = String(meta.status ?? '');
  return (foreshadowStatuses as readonly string[]).includes(value) ? (value as ForeshadowStatus) : '埋设';
}

export function detectForeshadowStatus(text: string): ForeshadowStatus {
  if (/废弃|弃用|作废/.test(text)) return '废弃';
  if (/揭示|已回收|回收|点明|呼应/.test(text)) return '揭示';
  return '埋设';
}

export interface ForeshadowCounts { planted: number; revealed: number; discarded: number; rate: number | null }

export function foreshadowCounts(items: Array<{ meta: Record<string, unknown> }>): ForeshadowCounts {
  let planted = 0, revealed = 0, discarded = 0;
  for (const item of items) {
    const status = readForeshadowStatus(item.meta);
    if (status === '揭示') revealed++;
    else if (status === '废弃') discarded++;
    else planted++;
  }
  const total = planted + revealed;
  return { planted, revealed, discarded, rate: total ? Math.round((revealed / total) * 100) : null };
}
