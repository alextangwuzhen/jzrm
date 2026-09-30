import { extractJson } from './ai';

export type ReusableSlot = { slot: string; material: string };
export type SplitReport = {
  premise: string;
  goldenChapters: string;
  structure: string;
  characters: string;
  dialogue: string;
  prose: string;
  hooks: string;
  worldbuilding: string;
  reusable: ReusableSlot[];
  example: string;
};

export const splitSlots: Array<{ key: keyof SplitReport; label: string; kind: 'style' | 'setting' | 'plot' }> = [
  { key: 'premise', label: '故事核 · 一句话卖点', kind: 'plot' },
  { key: 'goldenChapters', label: '黄金三章开篇手法', kind: 'plot' },
  { key: 'structure', label: '节奏与结构', kind: 'plot' },
  { key: 'characters', label: '人物动机 · 关系 · 声线', kind: 'setting' },
  { key: 'dialogue', label: '对白节奏 · 潜台词 · 语气', kind: 'style' },
  { key: 'prose', label: '文笔 · 句长 · 描写密度', kind: 'style' },
  { key: 'hooks', label: '钩子 · 爽点 · 反转 · 伏笔', kind: 'plot' },
  { key: 'worldbuilding', label: '世界观规则 · 地图 · 限制', kind: 'setting' }
];

const emptyReport = (): SplitReport => ({ premise: '', goldenChapters: '', structure: '', characters: '', dialogue: '', prose: '', hooks: '', worldbuilding: '', reusable: [], example: '' });

export function parseSplitReport(text: string): SplitReport {
  try {
    const data = extractJson(text) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      premise: str(data.premise ?? data.summary ?? ''),
      goldenChapters: str(data.goldenChapters ?? ''),
      structure: str(data.structure ?? ''),
      characters: str(data.characters ?? ''),
      dialogue: str(data.dialogue ?? ''),
      prose: str(data.prose ?? data.styleRules ?? ''),
      hooks: str(data.hooks ?? ''),
      worldbuilding: str(data.worldbuilding ?? ''),
      reusable: Array.isArray(data.reusable) ? data.reusable.map((x: unknown) => {
        const o = (x ?? {}) as Record<string, unknown>;
        return { slot: String(o.slot ?? ''), material: String(o.material ?? '') };
      }).filter(r => r.slot || r.material) : [],
      example: str(data.example ?? '')
    };
  } catch {
    return { ...emptyReport(), premise: text };
  }
}

/** 文风类槽位合并成文风包正文，其余作为可复用素材。 */
export function stylePackContent(report: SplitReport): string {
  const rules = [report.prose, report.dialogue, report.hooks].filter(Boolean).join('\n');
  return rules || report.premise || '拆解未得到可蒸馏的文风规则';
}
