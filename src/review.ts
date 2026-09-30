export const reviewDimensions = ['逻辑性', '人物弧光', '情绪描写', '叙事流畅度', '语言文风', '节奏', '限制词'] as const;

export function reviewEligibility(text: string): { eligible: boolean; score: null; reason?: string; length: number } {
  const length = text.replace(/\s/g, '').length;
  return { eligible: length >= 500, score: null, length, reason: length < 500 ? `至少需要 500 字的连续叙事文本；当前 ${length} 字。` : undefined };
}

export function createRewriteProposal(original: string, variants: string[]): { original: string; variants: string[]; selected: null } {
  if (variants.length !== 3) throw new Error('THREE_VARIANTS_REQUIRED');
  return { original, variants, selected: null };
}
