import { describe, expect, it } from 'vitest';
import { characterSummary, characterBrief, readProfile, readRelations, readGroup, isCharacterCard } from '../src/characters';
import { createInitialState, createEntity } from '../src/store';

describe('角色档案', () => {
  it('把结构化档案与关系汇总为可读文本并喂给 AI 上下文', () => {
    const summary = characterSummary(
      { name: '小师妹', alias: '阿蛮', age: '十七', identity: '玉兔族遗孤', appearance: '', personality: '嘴硬心软', background: '金乌屠族幸存者', speechHabit: '爱说“我偏不”', arc: '从逃避到担起责任' },
      [{ target: '小师弟', relation: '同门', note: '青梅竹马' }]
    );
    expect(summary).toContain('身份：玉兔族遗孤');
    expect(summary).toContain('角色弧光：从逃避到担起责任');
    expect(summary).toContain('人际关系 · 小师弟（同门）：青梅竹马');
  });

  it('缺省档案与关系能被安全读取', () => {
    expect(readProfile({}).name).toBe('');
    expect(readRelations({})).toEqual([]);
    expect(readGroup({})).toBe('未分组');
    expect(characterBrief(readProfile({}))).toBe('点击填写设定');
  });

  it('人物卡判定排除原始档案、关系资料与图片', () => {
    let state = createInitialState();
    state = createEntity(state, { id: 'a', kind: 'setting', title: '小师妹', category: 'characters', meta: { cardType: 'character' } });
    state = createEntity(state, { id: 'b', kind: 'setting', title: '人物档案', category: 'characters' });
    state = createEntity(state, { id: 'c', kind: 'setting', title: '人物关系', category: 'characters' });
    state = createEntity(state, { id: 'd', kind: 'setting', title: '图', category: 'characters', meta: { imageData: 'data:' } });
    const cards = state.entities.filter(isCharacterCard).map(e => e.id);
    expect(cards).toEqual(['a']);
  });
});
