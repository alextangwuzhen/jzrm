import type { AppState } from './store';
import { parseSettingDocument } from './settingImport';

export function migrateTimelineTables(state: AppState): AppState {
  const additions:AppState['entities']=[];
  const now=new Date().toISOString();
  const entities=state.entities.map(entity=>{
    if(entity.kind!=='setting'||entity.deletedAt||entity.category!=='timeline'||entity.title!=='事件时间线'||!entity.content.startsWith('timeline（时间线）'))return entity;
    const rows=parseSettingDocument(entity.content).filter(item=>item.category==='timeline'&&item.meta?.time);
    if(!rows.length)return entity;
    rows.forEach((row,index)=>{
      const id=`imported:timeline:${entity.id}:${index}`;
      if(state.entities.some(existing=>existing.id===id))return;
      additions.push({id,kind:'setting',title:row.title,content:row.content,workId:entity.workId,parentId:entity.parentId,category:'timeline',meta:row.meta??{},createdAt:now,updatedAt:now});
    });
    return {...entity,title:'原始时间线资料',category:'world',updatedAt:now};
  });
  return additions.length||entities.some((entity,index)=>entity!==state.entities[index])?{...state,entities:[...entities,...additions]}:state;
}

export function migrateInvalidModelIds(state: AppState): AppState {
  const suppliers=new Map(state.entities.filter(e=>e.kind==='provider'&&e.meta.role==='supplier').map(e=>[e.id,e]));
  let changed=false;
  const entities=state.entities.map(entity=>{
    if(entity.id==='preset:prompt:murder-mystery'&&!entity.deletedAt){changed=true;return {...entity,deletedAt:new Date().toISOString(),deleteBatchId:'migration:split-murder-prompt'};}
    if(entity.id==='preset:skill:script'&&entity.meta.source==='https://github.com/XucroYuri/how-to-make-script/blob/main/SKILL.md'){
      changed=true;
      return {...entity,meta:{...entity.meta,source:'https://github.com/danjdewhurst/story-skills/blob/main/skills/adaptation/SKILL.md'}};
    }
    if(entity.kind==='inspiration'&&entity.category==='角色名称'){changed=true;return {...entity,category:'角色设定'};}
    if(entity.kind!=='provider'||entity.meta.role!=='model'||String(entity.meta.model)!=='1')return entity;
    const parent=suppliers.get(entity.parentId??'');
    if(parent?.title!=='DeepSeek')return entity;
    changed=true;
    return {...entity,title:'deepseek-flash',meta:{...entity.meta,model:'deepseek-flash',migratedFrom:'1'}};
  });
  return changed?{...state,entities}:state;
}
