import { makeDiagramSvg, svgDataUrl } from './diagram';
import { updateEntity, type AppState } from './store';
export function migrateLegacyDiagrams(state:AppState):AppState{
 let next=state;
 for(const item of state.entities){
  if(item.deletedAt||item.kind!=='setting'||typeof item.meta.imageData!=='string'||(item.meta.imageFormat==='svg'&&Number(item.meta.diagramVersion)>=4))continue;
  const type=({characters:'characters',map:'map',timeline:'timeline'} as Record<string,'characters'|'map'|'timeline'>)[item.category??''];
  if(!type||!item.workId)continue;
  const work=state.entities.find(e=>e.id===item.workId);
  const facts=state.entities.filter(e=>!e.deletedAt&&e.kind==='setting'&&e.workId===item.workId&&e.category===item.category&&!e.meta.imageData);
  if(!facts.length)continue;
  next=updateEntity(next,item.id,{content:'由本作品现有设定重新排版，可在资料卡中编辑后重新生成。',meta:{...item.meta,imageData:svgDataUrl(makeDiagramSvg(`${work?.title??'作品'} · ${item.meta.diagramType}`,facts,type)),imageFormat:'svg',diagramVersion:4,diagramSource:'已有设定'}});
 }
 return next;
}
