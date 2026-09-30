import { describe, expect, it } from 'vitest';
import { createInitialState, createEntity } from '../src/store';
import { seedReaderAgents, readerPerspectives } from '../src/readerAgents';

describe('读者模拟 Agent 种子', () => {
  it('固定为三个读者 Agent，各装载一份对应 Skill，重复启动不重建', () => {
    let state = createInitialState();
    state = createEntity(state, { id: 'p', kind: 'provider', title: '评审模型', meta: { model: 'gpt', activeFor: ['读者'] } });
    const once = seedReaderAgents(state);
    const twice = seedReaderAgents(once);
    expect(readerPerspectives.map(p => p.name)).toEqual(['小白读者', '老书虫', '编辑视角']);
    expect(once.entities.filter(e => e.kind === 'agent' && e.category === '读者')).toHaveLength(3);
    expect(once.entities.filter(e => e.kind === 'skill' && e.category === '读者')).toHaveLength(3);
    for (const p of readerPerspectives) {
      const agent = once.entities.find(e => e.kind === 'agent' && e.meta.readerKey === p.key);
      expect(agent?.meta.skillId).toBe(`preset:reader-skill:${p.key}`);
      expect(agent?.meta.providerId).toBe('p');
    }
    expect(twice.entities.length).toBe(once.entities.length);
  });
});
