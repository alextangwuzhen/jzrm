import { useState } from 'react';
import { GripVertical, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from './context';
import { listEntities, type Entity } from './store';
import { imageSvgDataUrl } from './illustratedDiagram';
import { timelineDiagramSvg } from './diagram';
import { DiagramViewer } from './DiagramViewer';

export function timelineSortKey(value:string):number{
 const match=value.match(/(饶帝|羿帝)\s*(\d+)年/);
 if(!match)return Number.MAX_SAFE_INTEGER;
 return Number(match[2])+(match[1]==='羿帝'?36:0);
}

export function TimelinePage({work}:{work:Entity}){
 const app=useApp();const [dragged,setDragged]=useState('');const [busy,setBusy]=useState(false);const [expanded,setExpanded]=useState('');const [viewing,setViewing]=useState('');
 const all=listEntities(app.state,{kind:'setting',workId:work.id,category:'timeline'});
 const events=all.filter(e=>!e.meta.imageData&&!e.title.includes('原始时间线')).sort((a,b)=>Number(a.meta.order??timelineSortKey(String(a.meta.time??'')))-Number(b.meta.order??timelineSortKey(String(b.meta.time??'')))||a.createdAt.localeCompare(b.createdAt));
 const sources=all.filter(e=>e.title.includes('原始时间线')&&!e.meta.imageData);
 const figures=all.filter(e=>typeof e.meta.imageData==='string');
 const add=()=>{const e=app.add('setting','新事件','',{workId:work.id,parentId:work.id,category:'timeline',meta:{time:'',order:events.length*10}});setExpanded(e.id);};
 const move=(target:string)=>{if(!dragged||dragged===target)return;const ids=events.map(e=>e.id);const from=ids.indexOf(dragged),to=ids.indexOf(target);if(from<0||to<0)return;ids.splice(from,1);ids.splice(to,0,dragged);ids.forEach((id,i)=>{const e=events.find(x=>x.id===id)!;app.update(id,{meta:{...e.meta,order:i*10}});});setDragged('');};
 const draw=async()=>{if(!events.length){app.notify('先添加时间线事件');return;}setBusy(true);try{const svg=imageSvgDataUrl(timelineDiagramSvg(`${work.title} · 故事时间轴`,events));app.add('setting',`故事时间轴图 · ${new Date().toLocaleDateString('zh-CN')}`,'按当前事件顺序绘制，文字由本地生成。',{workId:work.id,parentId:work.id,category:'timeline',meta:{imageData:svg,imageFormat:'svg',diagramType:'故事时间轴图',diagramVersion:6}});figures.forEach(f=>app.trash(f.id));app.notify('时间轴图已生成');}catch(e){app.notify(String(e));}finally{setBusy(false);}};
 return <><div className="section-actions"><div><h3>时间线事件</h3><p className="muted">每行填写纪年与事件；拖动左侧手柄调整先后。修改会自动保存。</p></div><div className="action-row"><button className="button" disabled={busy} onClick={draw}><Sparkles size={15}/>{busy?'绘制中…':'绘制时间轴图'}</button><button className="button primary" onClick={add}><Plus size={15}/>新增事件</button></div></div><div className="timeline-editor">{events.map((event,i)=><div className={`timeline-event ${dragged===event.id?'dragging':''}`} key={event.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();move(event.id);}}><span className="timeline-grip" title="拖动调整顺序" draggable onDragStart={()=>setDragged(event.id)} onDragEnd={()=>setDragged('')}><GripVertical size={18}/></span><span className="timeline-number">{i+1}</span><input aria-label="纪年" placeholder="纪年（如饶帝30年）" value={String(event.meta.time??'')} onChange={e=>app.update(event.id,{meta:{...event.meta,time:e.target.value}})}/><input aria-label="事件" placeholder="事件（如金乌灭族）" value={event.title} onChange={e=>app.update(event.id,{title:e.target.value})}/><button className="button timeline-details-button" onClick={()=>setExpanded(expanded===event.id?'':event.id)}>{expanded===event.id?'收起':'详情'}</button><button className="icon-button danger" title="移入垃圾箱" onClick={()=>app.trash(event.id)}><Trash2 size={15}/></button>{expanded===event.id&&<textarea aria-label="事件详情" value={event.content} onChange={e=>app.update(event.id,{content:e.target.value})} placeholder="可选：参与角色、地点、证据与知情边界"/>}</div>)}{!events.length&&<div className="empty-small">还没有事件，点击新增事件开始。</div>}</div>{sources.length>0&&<details className="setting-sources"><summary>查看导入的原始时间线资料</summary>{sources.map(e=><pre key={e.id}>{e.content}</pre>)}</details>}{figures.length>0&&<section className="paper-page"><h3>已生成时间轴图</h3><div className="figure-gallery">{figures.map(f=><article key={f.id}><button className="figure-open" onClick={()=>setViewing(f.id)} title="查看大图"><img src={String(f.meta.imageData)} alt={f.title}/></button><strong>{f.title}</strong><button className="icon-button danger" onClick={()=>app.trash(f.id)} title="移入垃圾箱"><Trash2 size={14}/></button></article>)}</div></section>}{figures.find(f=>f.id===viewing)&&<DiagramViewer src={String(figures.find(f=>f.id===viewing)!.meta.imageData)} title={figures.find(f=>f.id===viewing)!.title} onClose={()=>setViewing('')}/>}</>;
}
