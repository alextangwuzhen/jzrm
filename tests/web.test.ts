import { describe, expect, it } from 'vitest';
import web from '../electron/web.cjs';

describe('联网搜索结果解析', () => {
  it('保留标题、来源地址、时间和摘要', () => {
    const found = web.parseExa('Title: 示例榜单\nURL: https://example.com/rank\nPublished: 2026-09-30\nHighlights:\n前三名与榜单说明\n\nTitle: 第二条\nURL: https://example.org/post\nPublished: N/A\nHighlights:\n另一段材料');
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ title: '示例榜单', url: 'https://example.com/rank', published: '2026-09-30' });
    expect(found[1].excerpt).toContain('另一段材料');
  });
  it('解析博查来源并过滤无效地址', () => {
    const found=web.parseBocha({data:{webPages:{value:[{name:'样本',url:'https://example.com',summary:'摘要',datePublished:'2026-09-30'},{name:'无链接'}]}}});
    expect(found).toEqual([{title:'样本',url:'https://example.com',excerpt:'摘要',published:'2026-09-30'}]);
  });
});
