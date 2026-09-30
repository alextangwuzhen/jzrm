import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from './context';
import { listEntities, type Entity } from './store';

const suggestions=['快乐','悲伤','愤怒','恐惧','释怀','羞愧','热血','委屈','笑','哭','沉默','失控','嘴硬','快乐的小二逼','克制的悲伤'];
type Phase={chapters:string;trait:string};
export function EmotionPage({work}:{work:Entity}){
 const app=useApp();const [tab,setTab]=useState<'整体情绪线'|'角色情绪变化'>('整体情绪线');
 const items=listEntities(app.state,{kind:'setting',workId:work.id,category:'emotion'});
 const arcs=items.filter(item=>item.meta.emotionScope==='character'),overall=items.filter(item=>item.meta.emotionScope!=='character');
 const chapters=listEntities(app.state,{kind:'chapter',workId:work.id});
 const add=()=>app.add('setting',tab==='整体情绪线'?'新情绪线':'新角色','',{workId:work.id,parentId:work.id,category:'emotion',meta:tab==='角色情绪变化'?{emotionScope:'character',phases:[{chapters:'',trait:''},{chapters:'',trait:''},{chapters:'',trait:''}]}:{emotionScope:'overall'}});
 const phases=(item:Entity)=>(Array.isArray(item.meta.phases)?item.meta.phases:[]) as Phase[];
 const setPhases=(item:Entity,next:Phase[])=>app.update(item.id,{meta:{...item.meta,phases:next}});
 return <><div className="category-tabs">{(['整体情绪线','角色情绪变化'] as const).map(x=><button key={x} className={tab===x?'selected':''} onClick={()=>setTab(x)}>{x}</button>)}</div><div className="section-actions"><p>{tab==='角色情绪变化'?'每个角色可添加或删除阶段；阶段分别关联章节并填写情绪、动作或短语。':'记录全书或卷章的整体情绪走向。'}</p><button className="button primary" onClick={add}><Plus size={15}/>+ 行</button></div><div className="emotion-list">{(tab==='角色情绪变化'?arcs:overall).map(item=><article className="entity-card emotion-card" key={item.id}><div className="emotion-card-head"><label>{tab==='角色情绪变化'?'角色名':'情绪线名称'}<input value={item.title} onChange={e=>app.update(item.id,{title:e.target.value})}/></label><button className="icon-button danger" onClick={()=>app.trash(item.id)} title="删除本行"><Trash2 size={16}/></button></div>{tab==='角色情绪变化'?<><div className="emotion-flow">{phases(item).map((phase,i)=><div className="emotion-phase" key={i}>{i>0&&<span className="emotion-arrow">→</span>}<div className="emotion-phase-fields"><input list="emotion-suggestions" aria-label={`第${i+1}阶段情绪`} value={phase.trait} onChange={e=>setPhases(item,phases(item).map((value,n)=>n===i?{...value,trait:e.target.value}:value))} placeholder={`情绪${i+1}`}/><input list="emotion-chapters" aria-label={`第${i+1}阶段章节`} value={phase.chapters} onChange={e=>setPhases(item,phases(item).map((value,n)=>n===i?{...value,chapters:e.target.value}:value))} placeholder="选择或输入章节"/></div><button className="icon-button danger" title="删除阶段" onClick={()=>setPhases(item,phases(item).filter((_,n)=>n!==i))}>×</button></div>)}<button className="button emotion-add-phase" onClick={()=>setPhases(item,[...phases(item),{chapters:'',trait:''}])}>+ 列</button></div><label>角色变化说明<textarea value={item.content} onChange={e=>app.update(item.id,{content:e.target.value})} placeholder="可选：解释转折原因、触发事件"/></label></>:<textarea value={item.content} onChange={e=>app.update(item.id,{content:e.target.value})} placeholder="例如：前期甜，中期埋刀，后期情绪回收"/>}</article>)}</div><datalist id="emotion-suggestions">{suggestions.map(x=><option key={x} value={x}/>)}</datalist><datalist id="emotion-chapters">{chapters.map(x=><option key={x.id} value={x.title}/>)}</datalist></>;
}
