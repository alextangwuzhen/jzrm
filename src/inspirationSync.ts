import { createEntity, moveToTrash, updateEntity, type AppState, type Entity, type NewEntity } from './store';

function target(category?:string):{kind:'setting'|'outline';category:string;meta?:Record<string,unknown>}|null{
  switch(category){
    case '角色设定': return {kind:'setting',category:'characters'};
    case '世界观': return {kind:'setting',category:'world',meta:{worldSection:'概览'}};
    case '剧情': return {kind:'outline',category:'章纲'};
    case '开书想法': return {kind:'outline',category:'总纲'};
    default: return null;
  }
}
export function syncInspiration(state:AppState,source:Entity):AppState{
  if(source.kind!=='inspiration'||!source.workId)return state;
  const spec=target(source.category);
  const linked=state.entities.find(item=>!item.deletedAt&&item.meta.sourceInspirationId===source.id);
  if(!spec)return linked?moveToTrash(state,linked.id):state;
  if(linked&&linked.kind===spec.kind)return updateEntity(state,linked.id,{title:source.title,content:source.content,category:spec.category,meta:{...linked.meta,...spec.meta}});
  if(linked)state=moveToTrash(state,linked.id);
  const input:NewEntity={id:crypto.randomUUID(),kind:spec.kind,title:source.title,content:source.content,workId:source.workId,parentId:source.id,category:spec.category,meta:{...spec.meta,sourceInspirationId:source.id}};
  return createEntity(state,input);
}
