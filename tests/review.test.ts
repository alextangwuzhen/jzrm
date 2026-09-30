import { describe, expect, it } from 'vitest';
import { reviewEligibility, reviewDimensions, reviewSeverities, createRewriteProposal } from '../src/review';

describe('审查修改', () => {
  it('材料不足时不输出看似精确的分数', () => {
    expect(reviewEligibility('测试文字。')).toMatchObject({ eligible: false, score: null });
  });

  it('章节评审维度对齐 StarWriter 的六个分项', () => {
    expect(reviewDimensions).toEqual(['设定一致性', '逻辑合理性', '人物塑造', '节奏把控', '文笔质量', '痕迹']);
    expect(reviewSeverities).toEqual(['严重', '轻微', '其他']);
  });

  it('三案提案创建时不改变原文', () => {
    const proposal = createRewriteProposal('原文', ['候选一', '候选二', '候选三']);
    expect(proposal.original).toBe('原文');
    expect(proposal.variants).toHaveLength(3);
    expect(proposal.selected).toBeNull();
  });
});
