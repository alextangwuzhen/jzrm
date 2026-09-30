import { describe, expect, it } from 'vitest';
import { reviewEligibility, reviewDimensions, reviewSeverities, reviewRoles, gradeBand, rhythmBreaks, publishReviewDimensions, createRewriteProposal } from '../src/review';

describe('审查修改', () => {
  it('材料不足时不输出看似精确的分数', () => {
    expect(reviewEligibility('测试文字。')).toMatchObject({ eligible: false, score: null });
  });

  it('章节评审维度对齐 StarWriter 的六个分项', () => {
    expect(reviewDimensions).toEqual(['设定一致性', '逻辑合理性', '人物塑造', '节奏把控', '文笔质量', '痕迹']);
    expect(reviewSeverities).toEqual(['严重', '轻微', '其他']);
  });

  it('五角色加权评审权重之和为 1', () => {
    const total = reviewRoles.reduce((n, r) => n + r.weight, 0);
    expect(total).toBeCloseTo(1);
    expect(reviewRoles.map(r => r.role)).toEqual(['阅读者', '编审', '故事家', '文学顾问', '毒舌读者']);
  });

  it('分级评分档位映射', () => {
    expect(gradeBand(93).grade).toBe('精品');
    expect(gradeBand(86).grade).toBe('优秀');
    expect(gradeBand(80).grade).toBe('良好');
    expect(gradeBand(66).grade).toBe('合格');
    expect(gradeBand(40).grade).toBe('重写');
  });

  it('三案提案创建时不改变原文', () => {
    const proposal = createRewriteProposal('原文', ['候选一', '候选二', '候选三']);
    expect(proposal.original).toBe('原文');
    expect(proposal.variants).toHaveLength(3);
    expect(proposal.selected).toBeNull();
  });

  it('情绪曲线标注相邻强度骤变', () => {
    const points = [
      { chapterId: 'a', chapterTitle: '第1章', emotion: '平静', intensity: 3 },
      { chapterId: 'b', chapterTitle: '第2章', emotion: '热血', intensity: 9 },
      { chapterId: 'c', chapterTitle: '第3章', emotion: '悲伤', intensity: 4 }
    ];
    expect(rhythmBreaks(points).length).toBe(2);
    expect(rhythmBreaks(points)[0]).toMatchObject({ index: 1, delta: 6 });
    expect(rhythmBreaks(points, 10)).toEqual([]);
  });

  it('发布审查为整书级七维', () => {
    expect(publishReviewDimensions).toEqual(['文风', '时间线', '伏笔', '节奏', '商业潜力', '编辑视角', '逻辑一致性']);
  });
});
