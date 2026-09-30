import { describe, expect, it } from 'vitest';
import { workContext } from '../src/ai';
import { createInitialState, createEntity, type Entity } from '../src/store';

const e = (id: string, kind: string, title: string, content: string, workId = 'w', category = '', meta: Record<string, unknown> = {}): Entity => ({ id, kind: kind as Entity['kind'], title, content, workId, category, meta, createdAt: '', updatedAt: '' });

describe('workContext 精准取用', () => {
  it('规则/记忆与大纲始终保留，不因超限被截掉', () => {
    let state = createInitialState();
    state = createEntity(state, { id: 'mem', kind: 'memory', title: '硬规则', content: '禁用解释式结尾', workId: 'w', category: 'facts' });
    const big = '字'.repeat(2000);
    for (let i = 0; i < 30; i++) state = createEntity(state, { id: `s${i}`, kind: 'setting', title: `设定${i}`, content: big, workId: 'w', category: 'world' });
    const ctx = workContext(state.entities, 'w', 3000);
    expect(ctx).toContain('硬规则');
  });

  it('优先取用本章出现的角色，其次伏笔与本章事件', () => {
    const ents = [
      e('c1', 'setting', '小师妹', '主角', 'w', 'characters'),
      e('c2', 'setting', '无关配角', '配角', 'w', 'characters'),
      e('f1', 'setting', '伏笔甲', '埋线', 'w', 'foreshadow'),
      e('t1', 'setting', '本章事件', '事件', 'w', 'timeline', { chapterId: 'ch1' }),
      e('t2', 'setting', '他章事件', '事件', 'w', 'timeline', { chapterId: 'ch9' })
    ];
    const ctx = workContext(ents, 'w', 1000, { chapterId: 'ch1', chapterText: '小师妹推门而入。' });
    const idx = (s: string) => ctx.indexOf(s);
    expect(idx('小师妹')).toBeGreaterThanOrEqual(0);
    expect(idx('小师妹')).toBeLessThan(idx('无关配角'));
    expect(idx('伏笔甲')).toBeLessThan(idx('无关配角'));
    expect(idx('本章事件')).toBeLessThan(idx('他章事件'));
  });

  it('无 focus 时退化为全量拼接', () => {
    const ents = [e('c1', 'setting', '甲', '内容', 'w', 'characters'), e('c2', 'setting', '乙', '内容', 'w', 'world')];
    const ctx = workContext(ents, 'w', 30000);
    expect(ctx).toContain('甲');
    expect(ctx).toContain('乙');
  });
});
