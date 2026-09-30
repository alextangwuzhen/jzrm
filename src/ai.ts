import type { Entity } from './store';
import type { ModelInput } from './platform';

export function modelFromProvider(provider?: Entity): ModelInput | null {
  if (!provider) return null;
  const baseUrl = String(provider.meta.baseUrl ?? '');
  const model = String(provider.meta.model ?? '');
  if (!baseUrl || !model) return null;
  return { providerId: provider.id, baseUrl, model, protocol: (provider.meta.protocol as 'openai'|'anthropic'|'gemini'|undefined)??'openai' };
}

export function modelLabel(provider: Entity, entities: Entity[]): string {
  const supplier = entities.find(e => e.id === provider.parentId);
  const id = String(provider.meta.model ?? '');
  return `${supplier?.title ?? '自定义'} · ${provider.title}${provider.title === id ? '' : ` (${id})`}`;
}

export function availableModels(entities: Entity[], purpose: 'text' | 'image' = 'text'): Entity[] {
  return entities.filter(e => e.kind === 'provider' && !e.deletedAt && typeof e.meta.model === 'string' && e.meta.model && (e.meta.purpose ?? 'text') === purpose);
}

export function pickModel(entities: Entity[], role: string, purpose: 'text' | 'image' = 'text'): Entity | undefined {
  const models = availableModels(entities, purpose);
  return models.find(model => Array.isArray(model.meta.activeFor) && model.meta.activeFor.includes(role)) ?? models[0];
}

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { const start = cleaned.search(/[\[{]/); const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']')); if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start,end+1)); throw new Error('模型未返回可解析的 JSON，可查看原始结果'); }
}

export function workContext(entities: Entity[], workId?: string, limit = 30000): string {
  const safeLimit = Math.max(3000, Math.min(100000, limit));
  const work=entities.find(e=>e.id===workId&&e.kind==='work'&&!e.deletedAt);
  const style=entities.find(e=>e.id===work?.meta.styleId&&e.kind==='style'&&!e.deletedAt);
  const rows=entities.filter(e=>!e.deletedAt && e.category!=='restriction' && ((workId && e.workId===workId && (['setting','memory','outline','fineOutline','style'].includes(e.kind)||(e.kind==='inspiration'&&e.meta.inLibrary))) || (e.kind==='memory' && !e.workId))).map(e=>`[${e.kind}/${e.category??''}] ${e.title}：${e.content}`);
  if(style)rows.unshift(`[已加载文风包] ${style.title}：${style.content}`);
  return rows.join('\n').slice(0,safeLimit);
}
