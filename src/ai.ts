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

export interface WorkContextFocus { chapterId?: string; chapterText?: string }

export function workContext(entities: Entity[], workId?: string, limit = 30000, focus?: WorkContextFocus): string {
  const safeLimit = Math.max(3000, Math.min(100000, limit));
  const work=entities.find(e=>e.id===workId&&e.kind==='work'&&!e.deletedAt);
  const style=entities.find(e=>e.id===work?.meta.styleId&&e.kind==='style'&&!e.deletedAt);
  const candidates=entities.filter(e=>!e.deletedAt && e.category!=='restriction' && ((workId && e.workId===workId && (['setting','memory','outline','fineOutline','style'].includes(e.kind)||(e.kind==='inspiration'&&e.meta.inLibrary))) || (e.kind==='memory' && !e.workId)));
  const row=(e:Entity)=>`[${e.kind}/${e.category??''}] ${e.title}：${e.content}`;
  // 规则/记忆、大纲/细纲结构、已加载文风：始终保留，不参与截断。
  const essential=candidates.filter(e=>e.kind==='memory');
  const structure=candidates.filter(e=>e.kind==='outline'||e.kind==='fineOutline');
  const settings=candidates.filter(e=>e.kind==='setting'||e.kind==='style'||e.kind==='inspiration');
  const chapterText=focus?.chapterText??'';
  // 按章节文本精准取用：出现过的角色最相关，本章伏笔/时间线事件次之。
  const charNames=chapterText?new Set(candidates.filter(e=>e.kind==='setting'&&e.category==='characters').map(e=>e.title).filter(name=>chapterText.includes(name))):null;
  const score=(e:Entity):number=>{
    if(!focus)return 50;
    if(e.category==='characters')return charNames?.has(e.title)?100:5;
    if(e.category==='foreshadow')return 80;
    if(e.category==='timeline')return e.meta.chapterId===focus.chapterId?90:40;
    if(e.category==='world'||e.category==='map')return 30;
    return 20;
  };
  const ordered=[...settings].sort((a,b)=>score(b)-score(a));
  const head=style?[`[已加载文风包] ${style.title}：${style.content}`,...structure.map(row),...essential.map(row)]:[...structure.map(row),...essential.map(row)];
  let budget=safeLimit-head.join('\n').length;
  const picked:string[]=[];
  for(const e of ordered){const r=row(e);if(budget-r.length-1<0)break;picked.push(r);budget-=r.length+1;}
  return [...head,...picked].join('\n');
}
