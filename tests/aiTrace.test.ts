import { describe, expect, it } from 'vitest';
import { scanAiTraces } from '../src/aiTrace';

describe('本地 AI 痕迹扫描', () => {
  it('命中 P0 感悟式结尾与 P1 泛用比喻', () => {
    const report = scanAiTraces('他走下山，这一刻终于明白，仿佛一切都清晰了。心中一动，不禁一怔。');
    const rules = report.hits.map(h => h.rule).join('；');
    expect(rules).toContain('感悟式结尾');
    expect(rules).toContain('泛用比喻');
    expect(report.hits.some(h => h.level === 'P0')).toBe(true);
  });

  it('句长单一、重复短语多时 AI 率偏高', () => {
    const report = scanAiTraces('他来了。他走了。他来了。他走了。他来了。他走了。');
    expect(report.stats.sentenceCount).toBeGreaterThanOrEqual(6);
    expect(report.stats.burstiness).toBeLessThan(3);
    expect(report.rate).toBeGreaterThan(0);
  });

  it('自然文本命中少、AI 率低', () => {
    const report = scanAiTraces('老张把烟掐了，转身往仓库走，铁门在风里吱呀响。他摸到那封信时，手指顿了顿，又塞回裤兜。');
    expect(report.hits.length).toBeLessThanOrEqual(1);
  });
});
