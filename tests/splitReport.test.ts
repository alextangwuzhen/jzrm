import { describe, expect, it } from 'vitest';
import { parseSplitReport, stylePackContent, splitSlots } from '../src/splitReport';

describe('拆书逐槽位报告', () => {
  it('解析槽位 JSON 并兼容旧 summary/styleRules 字段', () => {
    const report = parseSplitReport(JSON.stringify({ premise: '一句话卖点', prose: '句长短促', styleRules: '旧字段', characters: '主角动机', reusable: [{ slot: '对白', material: '潜台词写法' }], example: '原创示例' }));
    expect(report.premise).toBe('一句话卖点');
    expect(report.prose).toBe('句长短促');
    expect(report.reusable).toHaveLength(1);
    expect(report.example).toBe('原创示例');
  });

  it('无法解析时把原文放进 premise 而不崩溃', () => {
    const report = parseSplitReport('一段非 JSON 文本');
    expect(report.premise).toBe('一段非 JSON 文本');
    expect(report.reusable).toEqual([]);
  });

  it('风格包正文合并文风类槽位', () => {
    const report = parseSplitReport(JSON.stringify({ prose: '句长规则', dialogue: '对白规则', hooks: '钩子规则', premise: '卖点' }));
    expect(stylePackContent(report)).toContain('句长规则');
    expect(stylePackContent(report)).toContain('对白规则');
    expect(stylePackContent(report)).toContain('钩子规则');
  });

  it('槽位表覆盖八类拆解维度', () => {
    expect(splitSlots.map(s => s.key)).toEqual(['premise', 'goldenChapters', 'structure', 'characters', 'dialogue', 'prose', 'hooks', 'worldbuilding']);
  });
});
