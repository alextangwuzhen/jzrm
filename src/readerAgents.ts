import { createEntity, type AppState } from './store';

export type ReaderPerspective = { key: string; name: string; icon: string; desc: string; dimensions: string[] };

export const readerPerspectives: ReaderPerspective[] = [
  { key: 'newbie', name: '小白读者', icon: '🎮', desc: '18-25岁网文爱好者，追求爽感与节奏', dimensions: ['爽感', '节奏', '代入感', '悬念', '人物魅力'] },
  { key: 'veteran', name: '老书虫', icon: '📖', desc: '网文龄10年+，看重设定深度与逻辑', dimensions: ['设定深度', '逻辑严谨', '文笔质感', '人物立体', '世界观'] },
  { key: 'editor', name: '编辑视角', icon: '✏️', desc: '资深主编，关注商业潜力与IP改编', dimensions: ['开篇钩子', '黄金三章', '商业潜力', '节奏把控', 'IP改编力'] }
];

function skillContent(p: ReaderPerspective): string {
  return `你正在扮演「${p.name}」。${p.desc}。阅读以下章节后，从这些维度给出真实、具体的读者反馈：${p.dimensions.join('、')}。\n要求：第一印象；最吸引你的地方；看不懂或出戏的地方及原文位置；期待后续发生什么；给作者一条可执行建议。不要复述情节，不要客套。`;
}

/**
 * 三个读者模拟视角固定为「读者」类 Agent，各装载一份对应 Skill。
 * 幂等：只在缺少内置记录时创建，用户可随后编辑模型、Skill 与职责。
 */
export function seedReaderAgents(state: AppState): AppState {
  let next = state;
  const providers = next.entities.filter(e => e.kind === 'provider' && !e.deletedAt && typeof e.meta.model === 'string' && e.meta.model);
  const defaultProvider = providers.find(p => Array.isArray(p.meta.activeFor) && p.meta.activeFor.includes('读者')) ?? providers[0];
  for (const p of readerPerspectives) {
    const skillId = `preset:reader-skill:${p.key}`;
    const agentId = `preset:reader-agent:${p.key}`;
    if (!next.entities.some(e => e.id === skillId)) {
      next = createEntity(next, { id: skillId, kind: 'skill', title: `模拟读者反馈 · ${p.name}`, content: skillContent(p), category: '读者', meta: { summary: `${p.desc}（${p.dimensions.join('、')}）`, builtIn: true, readerKey: p.key } });
    }
    if (!next.entities.some(e => e.id === agentId)) {
      next = createEntity(next, { id: agentId, kind: 'agent', title: p.name, content: p.desc, category: '读者', meta: { builtIn: true, readerKey: p.key, providerId: defaultProvider?.id ?? '', skillId, styleId: '', dimensions: p.dimensions } });
    }
  }
  return next;
}
