import { useEffect, useRef, useState } from 'react';
import { Search, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from './context';
import { routeFor } from './routes';
import { extractJson, modelFromProvider, pickModel, workContext } from './ai';
import { platform, type WebResult } from './platform';
import { listEntities } from './store';

type Card={title:string;type:string;idea:string;sourceUrl:string};
type WorkshopDraft={keywords:string;cards:Card[];selected:number[];fusion:string;round:number};
function symbolIdea(card:Card){if(card.type!=='象征物'||/^(花语|托物言志)[：:]/.test(card.idea))return card.idea;return /花|玫瑰|百合|茉莉|梅|兰|菊|牡丹|莲|樱|蔷薇|海棠/.test(card.title)?`花语：${card.idea}`:`托物言志：${card.idea}`;}
const emptyDraft:WorkshopDraft={keywords:'',cards:[],selected:[],fusion:'',round:0};
function readDraft(content:string):WorkshopDraft{try{const value=JSON.parse(content);const all=Array.isArray(value.cards)?value.cards.map((card:Card)=>({...card,type:['花语','象征物'].includes(card.type)?'象征物':card.type})):[];const offset=Math.max(0,all.length-5);return {...emptyDraft,...value,cards:all.slice(-5),selected:Array.isArray(value.selected)?value.selected.filter((index:number)=>index>=offset).map((index:number)=>index-offset):[]};}catch{return emptyDraft;}}
export function NamesPage(){
  const app=useApp();
  const saved=listEntities(app.state,{kind:'attachment'}).find(e=>e.category==='炼丹炉草稿'&&e.workId===app.workId);
  const history=listEntities(app.state,{kind:'attachment'}).filter(e=>e.category==='炼丹炉记录'&&e.workId===app.workId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const draftId=useRef(saved?.id??'');
  const [draft,setDraft]=useState<WorkshopDraft>(()=>saved?readDraft(saved.content):emptyDraft);
  const migrated=useRef(false);
  useEffect(()=>{if(migrated.current||!saved||history.length)return;migrated.current=true;try{const old=JSON.parse(saved.content) as WorkshopDraft;if(!Array.isArray(old.cards)||old.cards.length<=5)return;for(let i=0;i<old.cards.length;i+=5){const round=Math.floor(i/5);app.add('attachment',`炼丹炉 · ${old.keywords} · 旧记录第${round+1}轮`,JSON.stringify({...old,cards:old.cards.slice(i,i+5),selected:[],round}),{workId:app.workId,category:'炼丹炉记录'});}app.update(saved.id,{content:JSON.stringify(readDraft(saved.content))});}catch{/* 旧草稿保持原样 */}},[]);
  const [gender,setGender]=useState('不限');const [genre,setGenre]=useState('不限题材');const [context,setContext]=useState('');const [busy,setBusy]=useState(false);
  const save=(next:WorkshopDraft)=>{setDraft(next);if(draftId.current)app.update(draftId.current,{content:JSON.stringify(next)});else{const entry=app.add('attachment','炼丹炉草稿',JSON.stringify(next),{workId:app.workId,category:'炼丹炉草稿'});draftId.current=entry.id;}};
  const search=async(more=false)=>{
    const keywords=draft.keywords.trim();if(!keywords){app.notify('请输入角色关键词');return;}
    setBusy(true);
    try{
      const round=more?draft.round+1:0;
      const angles=['人物原型 象征物 托物言志 OC 设定','人物关系 传说 隐喻 意象','性格反差 角色弧光 民俗','独特习惯 外部目标 内部矛盾'];
      const query=`${keywords} 角色创作 ${angles[round%angles.length]}`;
      const results=(await platform().searchWeb(query)).slice(0,10);
      if(!results.length)throw new Error('联网搜索没有返回来源');
      const model=modelFromProvider(pickModel(app.state.entities,'辅助'));
      let cards:Card[];
      if(model){
        const evidence=results.map((r,i)=>`[${i+1}] ${r.title} ${r.url}\n${r.excerpt.slice(0,800)}`).join('\n');
        const previous=more?`已有卡片标题：${draft.cards.map(c=>c.title).join('、')}。新一轮必须提供不同角度，不重复卡片。`:'';
        const answer=await platform().runAi({...model,prompt:`依据下面公开网页来源，为原创角色关键词「${keywords}」整理恰好5张不同的小卡，可用类型：人物原型、象征物、OC设定、人物关系、文化意象。象征物不限于花，也可用器物、天气、动物、建筑、习俗。花类须在 idea 中写“花语：”，其他物品写“托物言志：”，说明隐喻。${previous}不要捏造来源或照搬现有角色。返回 JSON 数组，每项 {"title":"","type":"","idea":"可迁移的原创设计点","sourceUrl":"给定来源URL之一"}。\n${evidence}`});
        const parsed=extractJson(answer);if(!Array.isArray(parsed))throw new Error('AI 未返回卡片数组');
        cards=parsed.slice(0,5).map((x:Record<string,unknown>)=>({title:String(x.title??''),type:String(x.type??'').replace('象征物','象征物').replace('花语','象征物'),idea:String(x.idea??''),sourceUrl:results.some(r=>r.url===x.sourceUrl)?String(x.sourceUrl):results[0].url}));
      }else cards=results.slice(0,5).map((r:WebResult,i)=>({title:r.title,type:['人物原型','象征物','OC设定','人物关系','文化意象'][i],idea:r.excerpt.slice(0,240),sourceUrl:r.url}));
      if(!cards.length)throw new Error('没有可展示的角色卡');
      const next={...draft,cards,selected:[],fusion:'',round};save(next);app.add('attachment',`炼丹炉 · ${keywords} · 第${round+1}轮`,JSON.stringify(next),{workId:app.workId,category:'炼丹炉记录'});
    }catch(e){app.notify(String(e));}finally{setBusy(false);}
  };
  const fuse=async()=>{if(draft.selected.length<2){app.notify('至少选两张卡');return;}const model=modelFromProvider(pickModel(app.state.entities,'辅助'));if(!model){app.notify('先配置辅助模型');return;}setBusy(true);try{const facts=workContext(app.state.entities,app.workId,app.state.preferences.contextLimit);const response=await platform().runAi({...model,prompt:`将下列角色灵感卡融合成原创角色设定。灵感卡只是候选材料，不是已确立的作品事实。必须先遵守作品资料和人物知情边界；与资料冲突的卡片元素应舍弃或单列为待确认候选，不得覆盖既有人物身世、亲属、世界规则或时间线。不要擅自新增神器、组织、童年惨案等重大设定。给出名字候选、外部目标、内部矛盾、秘密、与故事世界的关系、三个可演绎动作，并标明哪些内容来自已知事实，哪些是新提案。注明卡片来源，不直接复制已存在人物。\n作品资料：\n${facts}\n灵感卡：\n${draft.selected.map(i=>`${draft.cards[i].type}／${draft.cards[i].title}：${draft.cards[i].idea}`).join('\n')}`});save({...draft,fusion:response});}catch(e){app.notify(String(e));}finally{setBusy(false);}};
  return <><div className="page-intro"><div><span className="eyebrow">TOOLS / CHARACTER WORKSHOP</span><h2>捏脸工坊</h2><p>保留起名功能；炼丹炉可从关键词搜集角色参考卡并融合为原创设定。搜索结果自动保存。</p></div></div><div className="two-col"><section className="paper-page"><h3>自由起名</h3><div className="form-grid"><label>题材<select value={genre} onChange={e=>setGenre(e.target.value)}>{['不限题材','玄幻','都市','悬疑','言情','古风','科幻'].map(x=><option key={x}>{x}</option>)}</select></label><label>性别<select value={gender} onChange={e=>setGender(e.target.value)}>{['不限','女','男','其他'].map(x=><option key={x}>{x}</option>)}</select></label></div><label>角色身份与故事背景<textarea value={context} onChange={e=>setContext(e.target.value)} placeholder="例如：守着旧车站秘密的售票员"/></label><button className="button primary" onClick={()=>app.openAi(`请为${genre}题材、${gender}性别的角色起五个不同风格的中文名字。角色背景：${context}。每个解释音韵和人物适配理由。`)}><Sparkles size={16}/>开始头脑风暴</button></section><section className="paper-page"><h3>选小说换名</h3><p>在角色设定页选择作品中的人物，先核对当前名字及正文影响范围。</p><button className="button" onClick={()=>app.navigate(app.workId?routeFor(app.workId,'settings','characters'):'/library')}>前往角色设定</button></section></div><section className="paper-page alchemy-panel"><h3>炼丹炉</h3><p>输入性格、身份、时代、意象等关键词。每轮再取五张不同角度的卡，误触离开后可以接着选。</p><div className="search-box large"><Search size={18}/><input value={draft.keywords} onChange={e=>save({...draft,keywords:e.target.value})} placeholder="例如：失忆的药师、白山茶、双面间谍"/><button className="button primary" disabled={busy} onClick={()=>search(false)}>{busy?'检索中…':'搜索五张小卡'}</button></div><div className="alchemy-grid">{draft.cards.map((card,i)=><article className={`alchemy-card ${draft.selected.includes(i)?'selected':''}`} key={`${card.sourceUrl}-${i}`}><label className="check-inline"><input type="checkbox" checked={draft.selected.includes(i)} onChange={e=>save({...draft,selected:e.target.checked?[...draft.selected,i]:draft.selected.filter(x=>x!==i)})}/>{card.type}</label><h4>{card.title}</h4><p>{symbolIdea(card)}</p><a href={card.sourceUrl} target="_blank" rel="noreferrer">查看来源</a></article>)}</div>{draft.cards.length>0&&<div className="action-row"><button className="button" disabled={busy} onClick={()=>search(true)}>不满意，再来五张</button><button className="button primary" disabled={busy||draft.selected.length<2} onClick={fuse}><Sparkles size={15}/>融合所选 {draft.selected.length} 张卡</button></div>}<div className="history-panel"><h4>搜索历史</h4><div className="history-list">{history.map(h=><div className="history-row" key={h.id}><button className="button" onClick={()=>save(readDraft(h.content))}>{h.title}</button><button className="icon-button danger" title="移入垃圾箱" onClick={()=>app.trash(h.id)}><Trash2 size={14}/></button></div>)}{!history.length&&<small>每轮搜索结果会保存在这里。</small>}</div></div>{draft.fusion&&<div className="fusion-result"><div className="panel-heading"><h3>原创角色设定</h3><button className="button primary" onClick={()=>{app.add('inspiration',`角色设定：${draft.keywords}`,draft.fusion,{category:'角色设定',workId:app.workId,meta:{inLibrary:true,sourceLinks:draft.selected.map(i=>draft.cards[i].sourceUrl)}});save({...draft,fusion:''});app.notify('已保存到灵感库的角色设定');}}>保存到灵感库</button></div><textarea value={draft.fusion} onChange={e=>save({...draft,fusion:e.target.value})}/></div>}</section></>;
}
