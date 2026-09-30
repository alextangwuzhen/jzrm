export const reviewDimensions = ['设定一致性', '逻辑合理性', '人物塑造', '节奏把控', '文笔质量', '痕迹'] as const;
export const reviewSeverities = ['严重', '轻微', '其他'] as const;

export function reviewEligibility(text: string): { eligible: boolean; score: null; reason?: string; length: number } {
  const length = text.replace(/\s/g, '').length;
  return { eligible: length >= 500, score: null, length, reason: length < 500 ? `至少需要 500 字的连续叙事文本；当前 ${length} 字。` : undefined };
}

export function createRewriteProposal(original: string, variants: string[]): { original: string; variants: string[]; selected: null } {
  if (variants.length !== 3) throw new Error('THREE_VARIANTS_REQUIRED');
  return { original, variants, selected: null };
}
