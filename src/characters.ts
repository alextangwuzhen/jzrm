import type { Entity } from './store';

export type CharacterProfile = {
  name: string;
  alias: string;
  age: string;
  identity: string;
  appearance: string;
  personality: string;
  background: string;
  speechHabit: string;
  arc: string;
};

export type CharacterRelation = { target: string; relation: string; note: string };

export const emptyProfile: CharacterProfile = {
  name: '', alias: '', age: '', identity: '', appearance: '',
  personality: '', background: '', speechHabit: '', arc: ''
};

const profileFields: Array<[keyof CharacterProfile, string]> = [
  ['alias', '别名'], ['age', '年龄'], ['identity', '身份'], ['appearance', '外貌'],
  ['personality', '性格'], ['background', '背景'], ['speechHabit', '说话习惯'], ['arc', '角色弧光']
];

export function readProfile(meta: Record<string, unknown>): CharacterProfile {
  const source = (meta.profile ?? {}) as Partial<CharacterProfile>;
  return { ...emptyProfile, ...source };
}

export function readRelations(meta: Record<string, unknown>): CharacterRelation[] {
  if (!Array.isArray(meta.relations)) return [];
  return (meta.relations as Array<Partial<CharacterRelation>>)
    .map(r => ({ target: String(r.target ?? ''), relation: String(r.relation ?? ''), note: String(r.note ?? '') }))
    .filter(r => r.target || r.relation || r.note);
}

export function readGroup(meta: Record<string, unknown>): string {
  const group = String(meta.group ?? '').trim();
  return group || '未分组';
}

/** A compact, human-readable summary that also feeds the AI context. */
export function characterSummary(profile: CharacterProfile, relations: CharacterRelation[]): string {
  const lines: string[] = [];
  if (profile.name) lines.push(`名字：${profile.name}`);
  for (const [key, label] of profileFields) {
    const value = profile[key].trim();
    if (value) lines.push(`${label}：${value}`);
  }
  for (const relation of relations) {
    if (!relation.target) continue;
    lines.push(`人际关系 · ${relation.target}（${relation.relation || '未注明关系'}）${relation.note ? `：${relation.note}` : ''}`);
  }
  return lines.join('\n');
}

/** Human-readable short line for a card preview. */
export function characterBrief(profile: CharacterProfile): string {
  const parts = [profile.identity, profile.personality, profile.background].map(x => x.trim()).filter(Boolean);
  return parts.join('；') || '点击填写设定';
}

export function isCharacterCard(entity: Entity): boolean {
  return entity.kind === 'setting' && entity.category === 'characters'
    && !entity.meta.imageData && entity.title !== '人物档案' && entity.title !== '人物关系';
}
