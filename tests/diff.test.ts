import { describe, expect, it } from 'vitest';
import { diffChars } from '../src/diff';
import { radarSvg } from '../src/diagram';

describe('改动高亮 diff', () => {
  it('标出删除与新增', () => {
    const segs = diffChars('他终于明白了一切。', '他懂了。');
    expect(segs.some(s => s.type === 'del')).toBe(true);
    expect(segs.some(s => s.type === 'ins')).toBe(true);
    expect(segs.filter(s => s.type !== 'same').length).toBeGreaterThan(0);
  });

  it('相同文本全部为 same', () => {
    expect(diffChars('abc', 'abc').every(s => s.type === 'same')).toBe(true);
  });

  it('文本过大时返回空并降级', () => {
    const big = '字'.repeat(5000);
    expect(diffChars(big, big)).toEqual([]);
  });
});

describe('雷达图', () => {
  it('生成含维度标签与分值的 SVG', () => {
    const svg = radarSvg(['设定一致性', '逻辑合理性'], { 设定一致性: 80, 逻辑合理性: 70 });
    expect(svg).toContain('设定一致性');
    expect(svg).toContain('80');
    expect(svg).toContain('<polygon');
  });
});
