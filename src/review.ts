export const reviewDimensions = ['设定一致性', '逻辑合理性', '人物塑造', '节奏把控', '文笔质量', '痕迹'] as const;
export const reviewSeverities = ['严重', '轻微', '其他'] as const;

export interface ReviewRole { role: string; weight: number; score: number; opinion: string; quote: string }
export interface ReviewRedline { level: 'P0' | 'P1'; rule: string; quote: string; reason: string; suggestion: string }
export interface ReviewContinuity { kind: string; expect: string; actual: string; quote: string; suggestion: string }

export const reviewRoles: ReviewRole[] = [
  { role: '阅读者', weight: 0.25, score: 0, opinion: '', quote: '' },
  { role: '编审', weight: 0.25, score: 0, opinion: '', quote: '' },
  { role: '故事家', weight: 0.25, score: 0, opinion: '', quote: '' },
  { role: '文学顾问', weight: 0.15, score: 0, opinion: '', quote: '' },
  { role: '毒舌读者', weight: 0.10, score: 0, opinion: '', quote: '' }
];
export const roleFocus: Record<string, string> = {
  阅读者: '开篇吸引力、节奏、画面感',
  编审: '错别字、病句、一致性',
  故事家: '剧情逻辑、伏笔、钩子',
  文学顾问: '语言艺术、人物刻画',
  毒舌读者: '套路化、水文、毒点'
};
export const redlineRules = [
  { level: 'P0' as const, rule: '明显AI词汇（众所周知/不言而喻等）' },
  { level: 'P0' as const, rule: '感悟式结尾（他终于明白/她终于懂得）' },
  { level: 'P0' as const, rule: '感叹式结尾（真是太/多么）' },
  { level: 'P0' as const, rule: '上帝视角（所有人没想到/全书第X章）' },
  { level: 'P1' as const, rule: '仿佛/宛如堆叠' },
  { level: 'P1' as const, rule: '三句同构排比' },
  { level: 'P1' as const, rule: '段尾重复总结' }
];

export function gradeBand(score: number): { grade: string; hint: string } {
  if (score >= 90) return { grade: '精品', hint: '可直接发布' };
  if (score >= 85) return { grade: '优秀', hint: '可发布' };
  if (score >= 75) return { grade: '良好', hint: '小改可发' };
  if (score >= 60) return { grade: '合格', hint: '需修改' };
  return { grade: '重写', hint: '需重写' };
}

export function reviewEligibility(text: string): { eligible: boolean; score: null; reason?: string; length: number } {
  const length = text.replace(/\s/g, '').length;
  return { eligible: length >= 500, score: null, length, reason: length < 500 ? `至少需要 500 字的连续叙事文本；当前 ${length} 字。` : undefined };
}

export function createRewriteProposal(original: string, variants: string[]): { original: string; variants: string[]; selected: null } {
  if (variants.length !== 3) throw new Error('THREE_VARIANTS_REQUIRED');
  return { original, variants, selected: null };
}
