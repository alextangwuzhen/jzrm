import { describe, expect, it } from 'vitest';
import { routeFor, parseRoute, settingCategories } from '../src/routes';

describe('作品分级路由', () => {
  it('五个工作区分别有独立且可解析的地址', () => {
    const pages = ['outline', 'settings', 'memory', 'fine-outline', 'body'] as const;
    const urls = pages.map(page => routeFor('work-1', page));
    expect(new Set(urls).size).toBe(5);
    expect(urls.map(parseRoute).map(route => route.page)).toEqual(pages);
    expect(urls.every(url => parseRoute(url).workId === 'work-1')).toBe(true);
  });

  it('设定有独立分类页', () => {
    expect(settingCategories).toContain('characters');
    expect(settingCategories).toContain('timeline');
    expect(parseRoute('/work/w/settings/characters')).toMatchObject({ workId: 'w', page: 'settings', category: 'characters' });
  });
});
