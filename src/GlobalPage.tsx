import { useEffect, useState } from 'react';
import { ArrowRight, Lightbulb, Plus, Search, Sparkles, Trash2, Upload, RotateCcw } from 'lucide-react';
import { useApp } from './context';
import { listEntities, type Entity, type EntityKind } from './store';
import { routeFor } from './routes';
import { platform } from './platform';
import { modelFromProvider, pickModel } from './ai';
import { ReviewPage } from './ReviewPage';
import { AdaptationPage } from './AdaptationPage';
import { AgentsPage } from './AgentsPage';
import { AiConfigPage } from './AiConfigPage';
import { StylesPage, SplitPage } from './StylesPage';
import { NamesPage } from './NamesPage';
import { parseSettingDocument } from './settingImport';

export function GlobalPage({ page, category }: { page: string; category?: string }) {
  if (page === 'home') return <HomePage/>;
  if (page === 'library') return <LibraryPage/>;
  if (page === 'reader') return <ReaderPage/>;
  if (page === 'inspiration') return <InspirationPage category={category}/>;
  if (page === 'names') return <NamesPage/>;
  if (page === 'trash') return <TrashPage/>;
  if (page === 'review') return <ReviewPage key="review"/>;
  if (page === 'adaptation') return <AdaptationPage/>;
  if (page === 'polish') return <ReviewPage key="polish" polish/>;
  if (page === 'ai-config') return <AiConfigPage/>;
  if (page === 'agents') return <AgentsPage category={category}/>;
  if (page === 'styles') return <StylesPage/>;
  if (page === 'split') return <SplitPage/>;
  if (page === 'search') return <SearchPage/>;
  if (page === 'help') return <HelpPage/>;
  if (page === 'settings') return <SettingsPage category={category}/>;
  return <div className="paper-page"><h2>JZRM 使用说明</h2><p>从作品库创建作品，依次进入大纲、设定、细纲、正文和审校。右上角的助手与脑暴可在所有页面打开。</p></div>;
}

function HelpPage() {
  const app=useApp();
  const backup=async()=>{try{const file=await platform().backup();if(file)app.notify(`备份已保存：${file}`);}catch(e){app.notify(`备份失败：${String(e)}`);}};
  const restore=async()=>{if(!await app.confirm('恢复备份会替换当前全部作品、章节、设定和配置。继续吗？'))return;try{const next=await platform().restoreBackup();if(next){app.replaceState(next);app.notify('备份已恢复');app.navigate('/library');}}catch(e){app.notify(`恢复失败：${String(e)}`);}};
  return <><SectionHead overline="JZRM / GUIDE" title="使用说明" subtitle="从作品与灵感开始，逐步完成创作、审校和剧本杀改编。"/><div className="two-col"><section className="paper-page"><h3>创作路径</h3><ol className="steps-list"><li>在灵感泡泡记录故事想法，再进入作品库创建小说。</li><li>每部作品分别维护大纲、设定、记忆、细纲和正文。</li><li>使用审查修改核对文本，再进入剧本杀改编工作区。</li><li>右上角可随时打开助手、脑暴与流程提示。</li></ol></section><section className="paper-page"><h3>本地备份</h3><p>将作品、章节、配置和垃圾箱内容保存为 JSON 文件。API 密钥由系统加密保管，不包含在备份中。</p><div className="action-row"><button className="button primary" onClick={backup}>导出完整备份</button><button className="button" onClick={restore}>从备份恢复</button></div></section></div></>;
}

function SettingsPage({category}:{category?:string}) {
  const app=useApp();
  const selected=category??'guide';
  const sections=[['guide','使用说明'],['theme','主题设置'],['memory','固定记忆区'],['compression','压缩设置'],['cloud','云同步']];
  const memories=listEntities(app.state,{kind:'memory'}).filter(e=>!e.workId);
  const setPreference=(patch:Partial<typeof app.state.preferences>)=>app.replaceState({...app.state,preferences:{...app.state.preferences,...patch}});
  return <><SectionHead overline="PREFERENCES / JZRM" title="设置" subtitle="调整外观、固定记忆和 AI 上下文长度。"/><div className="category-tabs">{sections.map(([key,label])=><button key={key} className={selected===key?'selected':''} onClick={()=>app.navigate(`/settings/${key}`)}>{label}</button>)}</div>
    {selected==='guide'&&<HelpPage/>}
    {selected==='theme'&&<section className="paper-page"><h3>主题设置</h3><p>日间米白与灰，夜间黑与银。切换后自动保存。</p><div className="theme-options"><button className={`theme-choice daylight ${app.state.preferences.theme!=='dark'?'selected':''}`} onClick={()=>setPreference({theme:'light'})}><span className="theme-preview"/><strong>日间 · 米白 + 灰</strong><small>柔和纸面与磨砂玻璃按钮</small></button><button className={`theme-choice nightlight ${app.state.preferences.theme==='dark'?'selected':''}`} onClick={()=>setPreference({theme:'dark'})}><span className="theme-preview"/><strong>夜间 · 黑 + 银</strong><small>深色画布与银色高光</small></button></div></section>}
    {selected==='memory'&&<section className="paper-page"><div className="panel-heading"><h3>固定记忆区</h3><button className="button primary" onClick={async()=>{const name=await app.ask('固定记忆名称');if(name)app.add('memory',name,'',{category:'learned'});}}>添加记忆</button></div><p>这些规则会进入所有作品的 AI 上下文，可随时编辑或移入垃圾箱。</p>{memories.map(item=><div className="model-card" key={item.id}><div className="card-top"><input value={item.title} onChange={e=>app.update(item.id,{title:e.target.value})}/><button className="icon-button danger" onClick={()=>app.trash(item.id)}><Trash2 size={15}/></button></div><textarea value={item.content} onChange={e=>app.update(item.id,{content:e.target.value})}/></div>)}{!memories.length&&<div className="empty-small">还没有固定记忆。</div>}</section>}
    {selected==='compression'&&<section className="paper-page"><h3>压缩设置</h3><p>设定发送给 AI 的作品资料上限。超过上限时从末尾截断，优先把最重要的事实与限制写在资料前部。</p><label>上下文资料字数上限<input type="number" min="3000" max="100000" step="1000" value={app.state.preferences.contextLimit??30000} onChange={e=>setPreference({contextLimit:Math.max(3000,Math.min(100000,Number(e.target.value)||3000))})}/></label><p className="muted">当前上限：{(app.state.preferences.contextLimit??30000).toLocaleString()} 字。原始作品内容不会被删改。</p></section>}
    {selected==='cloud'&&<CloudSync/>}
  </>;
}

function CloudSync() {
  const app = useApp();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean; syncedAt: string | null }>({ configured: false, syncedAt: null });
  useEffect(() => { platform().cloudStatus().then(setStatus).catch(() => {}); }, []);
  const saveToken = async () => {
    if (!token.trim()) { app.notify('请输入 GitHub Token'); return; }
    try { await platform().saveKey('sync:github', token.trim()); setToken(''); setStatus(await platform().cloudStatus()); app.notify('GitHub Token 已保存'); } catch (e) { app.notify(String(e)); }
  };
  const push = async () => { setBusy(true); try { const r = await platform().cloudPush(app.state); setStatus({ configured: true, syncedAt: r.at }); app.notify(`已同步到云端 ${new Date(r.at).toLocaleString('zh-CN')}`); } catch (e) { app.notify(String(e)); } finally { setBusy(false); } };
  const pull = async () => { if (!await app.confirm('从云端恢复会替换当前全部作品、章节、设定和配置。继续吗？')) return; setBusy(true); try { app.replaceState(await platform().cloudPull()); app.notify('已从云端恢复'); app.navigate('/library'); } catch (e) { app.notify(String(e)); } finally { setBusy(false); } };
  return <section className="paper-page"><h3>云同步（GitHub Gist）</h3>
    <p className="muted">用你的 GitHub Token 把作品数据同步为私有 Gist（文件 jzrm-state.json）。Token 存于 macOS 钥匙串，同步时按需上传正文与设定，不包含 API 密钥。</p>
    <label>GitHub Token<input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_...（需勾选 gist 权限）" /></label>
    <div className="action-row" style={{ marginTop: 12 }}><button className="button" onClick={saveToken}>保存 Token</button><button className="button primary" disabled={busy || !status.configured} onClick={push}>{busy ? '同步中…' : '立即同步到云端'}</button><button className="button" disabled={busy || !status.configured} onClick={pull}>{busy ? '恢复中…' : '从云端恢复'}</button></div>
    <p className="muted" style={{ marginTop: 10 }}>状态：{status.configured ? (status.syncedAt ? `已配置，最近同步 ${new Date(status.syncedAt).toLocaleString('zh-CN')}` : '已配置 Token，尚未同步') : '尚未配置 GitHub Token'}。</p>
  </section>;
}

function SectionHead({ overline, title, subtitle, action }: { overline: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><span className="eyebrow">{overline}</span><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

function HomePage() {
  const app = useApp();
  const works = listEntities(app.state, { kind: 'work' });
  const chapters = listEntities(app.state, { kind: 'chapter' });
  const count = chapters.reduce((n, c) => n + c.content.replace(/\s/g,'').length, 0);
  const active = works.find(w => w.id === app.state.preferences.activeWorkId) ?? works[0];
  return <><div className="hero"><span className="eyebrow">YOUR STORY STARTS HERE</span><h2>见字如面，我们的故事才刚刚开始。</h2><p>从灵感，到小说，再到每个角色亲历的剧本杀故事。</p><div className="action-row"><button className="button primary" onClick={() => app.navigate('/library')}><Plus size={16}/>创建作品</button><button className="button" onClick={() => app.navigate('/review')}>审查修改<ArrowRight size={16}/></button></div></div><div className="stat-grid"><div><span>总作品</span><strong>{works.length}</strong><small>部</small></div><div><span>总章节</span><strong>{chapters.length}</strong><small>章</small></div><div><span>正文字数</span><strong>{count.toLocaleString()}</strong><small>字</small></div><div><span>内置读者 Agent</span><strong>3</strong><small>视角</small></div></div><div className="home-grid"><section className="paper-page"><div className="panel-heading"><h3>继续创作</h3><button className="text-button" onClick={() => app.navigate('/library')}>全部作品<ArrowRight size={15}/></button></div>{active ? <div className="featured-work"><div className="cover-tile">J</div><div><strong>{active.title}</strong><p>{active.content || '故事正在等待下一页。'}</p><button className="button primary" onClick={() => app.navigate(routeFor(active.id, 'body'))}>继续编辑</button></div></div> : <div className="empty-small">还没有作品，创建第一部开始吧。</div>}</section><section className="paper-page"><h3>建议创作顺序</h3><ol className="steps-list"><li>记录灵感，整理故事方向</li><li>提炼大纲与作品设定</li><li>细纲与正文逐章创作</li><li>审校后改编剧本杀并复审</li></ol></section></div></>;
}

function LibraryPage() {
  const app = useApp(); const [query, setQuery] = useState('');
  const works = listEntities(app.state, { kind: 'work' }).filter(w => w.title.includes(query));
  const create = async () => { const title = await app.ask('作品名称'); if (!title) return; const work = app.add('work', title, '', { meta: { genre: '未分类', status: '规划中' } }); app.navigate(routeFor(work.id, 'body')); };
  const importWork = async () => { try { const file = await platform().importText(); if (!file) return; const title = file.name.replace(/\.[^.]+$/, ''); const work = app.add('work', title, '', { meta: { genre: '导入作品' } }); const volume = app.add('volume', '第 1 卷', '', { workId: work.id, parentId: work.id }); const chapter = app.add('chapter', '导入正文', file.text, { workId: work.id, parentId: volume.id }); app.navigate(routeFor(work.id, 'body', chapter.id)); } catch (e) { app.notify(String(e)); } };
  return <><SectionHead overline="LIBRARY / ALL STORIES" title="作品库" subtitle="管理每一部正在生长的故事，作品切换时资料与流程一起切换。" action={<div className="action-row"><button className="button" onClick={importWork}><Upload size={16}/>导入小说</button><button className="button primary" onClick={create}><Plus size={16}/>新建作品</button></div>}/><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索作品"/></div><div className="work-grid">{works.map(work => { const chapters = listEntities(app.state, { kind: 'chapter', workId: work.id }); return <article key={work.id} className="work-card"><div className="work-cover"><span>J</span><button title="删除作品" onClick={() => app.trash(work.id)}><Trash2 size={16}/></button></div><div className="work-card-content"><span className="tiny-label">{String(work.meta.status ?? '规划中')}</span><h3>{work.title}</h3><p>{work.content || '暂无简介，点击进入作品开始写作。'}</p><small>{chapters.length} 章 · {chapters.reduce((n,c)=>n+c.content.length,0)} 字</small><div className="action-row"><button className="button primary" onClick={() => app.navigate(routeFor(work.id, 'body'))}>继续写作</button><button className="button" onClick={() => app.navigate(routeFor(work.id, 'settings'))}>设定</button></div></div></article>; })}{!works.length && <div className="empty-state wide"><h3>还没有作品</h3><p>创建一部新作品，或导入现有的小说正文。</p><button className="button primary" onClick={create}>开始一个新故事</button></div>}</div></>;
}

function ReaderPage() {
  const app = useApp(); const [selected, setSelected] = useState<string | null>(null); const [filter, setFilter] = useState('全部'); const [diagramPreview,setDiagramPreview]=useState<Entity|null>(null);
  const works = listEntities(app.state, { kind: 'work' });
  const work = works.find(w => w.id === selected) ?? works[0];
  const chapters = work ? listEntities(app.state, { kind: 'chapter', workId: work.id }) : [];
  const [chapterId, setChapterId] = useState<string | null>(null); const chapter = chapters.find(c => c.id === chapterId) ?? chapters[0];
  const diagrams=work?listEntities(app.state,{kind:'setting',workId:work.id}).filter(item=>typeof item.meta.imageData==='string'&&item.meta.diagramType):[];
  return <><SectionHead overline="READING SPACE / ALL STORIES" title="阅读空间" subtitle="按作品、章节与角色视角阅读，回到创作页时保留当前位置。"/><div className="category-tabs">{['全部','我的作品','用户上传','角色视角'].map(x => <button key={x} className={filter===x?'selected':''} onClick={() => setFilter(x)}>{x}</button>)}</div>{work ? <div className="reader-layout"><aside className="chapter-tree"><div className="panel-heading"><strong>作品与目录</strong></div><select value={work.id} onChange={e => { setSelected(e.target.value); setChapterId(null); }}>{works.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}</select>{chapters.map(c => <button className={`chapter-link ${chapter?.id===c.id?'active':''}`} key={c.id} onClick={() => setChapterId(c.id)}>{c.title}</button>)}</aside><article className="reading-paper"><span className="eyebrow">{work.title}</span><h2>{chapter?.title ?? '暂无章节'}</h2><div className="reading-body">{chapter?.content ?? '这部作品还没有正文。'}</div></article><aside className="reader-aside"><h3>人物与地点</h3><p>作品设定中的人物、地点会显示在这里。</p><button className="button" onClick={() => app.navigate(routeFor(work.id,'settings','characters'))}>查看人物</button><h3>作品图谱</h3>{diagrams.map(item=><details className="reader-diagram" key={item.id}><summary>{item.title}</summary><button className="reader-diagram-open" onClick={()=>setDiagramPreview(item)}><img src={String(item.meta.imageData)} alt={item.title}/><span>查看大图</span></button><a href={String(item.meta.imageData)} download={`${item.title}.${item.meta.imageFormat==='svg'?'svg':'png'}`}>下载图表</a></details>)}{!diagrams.length&&<p className="muted">在作品设定中生成人物、地图或时间轴图后，这里会同步显示。</p>}</aside></div> : <div className="empty-state"><h3>还没有可阅读的作品</h3><button className="button" onClick={() => app.navigate('/library')}>前往作品库</button></div>}{diagramPreview&&<div className="modal-backdrop" onClick={()=>setDiagramPreview(null)}><div className="diagram-modal" onClick={e=>e.stopPropagation()}><div className="panel-heading"><h3>{diagramPreview.title}</h3><button className="button" onClick={()=>setDiagramPreview(null)}>关闭</button></div><img src={String(diagramPreview.meta.imageData)} alt={diagramPreview.title}/><a className="button" href={String(diagramPreview.meta.imageData)} download={`${diagramPreview.title}.svg`}>下载 SVG</a></div></div>}</>;
}

const ideaCategories = ['全部','开书想法','剧情','角色设定','世界观','其他','灵感库'];
function InspirationPage({ category }: { category?: string }) {
  const app=useApp();const page=ideaCategories.includes(category??'')?category!:'全部';
  const [query,setQuery]=useState('');const [checked,setChecked]=useState<string[]>([]);const [fused,setFused]=useState('');const [busy,setBusy]=useState(false);
  const all=listEntities(app.state,{kind:'inspiration'});
  const ideas=all.filter(i=>(page==='灵感库'?Boolean(i.meta.inLibrary):page==='全部'||i.category===page)&&`${i.title}${i.content}`.includes(query));
  const selected=all.filter(i=>checked.includes(i.id));
  const create=async()=>{const title=await app.ask('灵感标题');if(title)app.add('inspiration',title,'',{category:page==='全部'||page==='灵感库'?'开书想法':page,workId:app.workId,meta:{inLibrary:page==='灵感库'}});};
  const importIdea=async()=>{try{const file=await platform().importText();if(!file)return;const workId=app.workId;app.add('inspiration',file.name,file.text,{category:'其他',workId,meta:{inLibrary:true,sourceFile:file.name}});if(workId){const sections=parseSettingDocument(file.text);for(const section of sections)app.add(section.kind,section.title,section.content,{workId,parentId:workId,category:section.category,meta:{...section.meta,sourceFile:file.name}});app.notify(`已导入灵感，并同步 ${sections.length} 条到作品设定／大纲／记忆`);}else app.notify('已导入灵感；选择作品后可将资料导入该作品的设定。');}catch(e){app.notify(String(e));}};
  const moveSelected=()=>{selected.forEach(i=>app.update(i.id,{meta:{...i.meta,inLibrary:true}}));setChecked([]);app.notify(`已将 ${selected.length} 条灵感加入灵感库`);};
  const fuse=async()=>{if(selected.length<2){app.notify('请至少选择两条灵感');return;}const model=modelFromProvider(pickModel(app.state.entities,'辅助'));if(!model){app.notify('请先配置辅助模型');return;}setBusy(true);try{const result=await platform().runAi({...model,prompt:`把以下灵感融合扩展为一个可执行故事方案。区分哪些要素相容、哪些冲突；给出核心设定、人物关系、冲突链、三个场景、可选反转。保留来源灵感的独特性，不凭空引用现实事实。\n${selected.map((i,n)=>`[${n+1}] ${i.category}/${i.title}：${i.content}`).join('\n')}`});setFused(result);}catch(e){app.notify(String(e));}finally{setBusy(false);}};
  return <><SectionHead overline="INSPIRATION / IDEAS" title="灵感泡泡" subtitle="在分类页收集片段，选入灵感库后组合成故事方案。" action={<div className="action-row"><button className="button" onClick={()=>app.openAi('请给出三个有冲突、角色和反转的原创小说灵感。')}><Sparkles size={16}/>随机灵感</button><button className="button" onClick={importIdea}><Upload size={16}/>导入灵感资料</button><button className="button primary" onClick={create}><Plus size={16}/>新建灵感</button></div>}/><div className="category-tabs">{ideaCategories.map(x=><button key={x} className={page===x?'selected':''} onClick={()=>{setChecked([]);app.navigate(`/inspiration/${x}`);}}>{x}{x==='灵感库'&&<small> {all.filter(i=>i.meta.inLibrary).length}</small>}</button>)}</div><div className="search-box"><Search size={16}/><input placeholder="搜索灵感" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="inspiration-toolbar"><span>已选择 {checked.length} 条</span>{page==='灵感库'?<button className="button primary" disabled={busy||selected.length<2} onClick={fuse}><Sparkles size={15}/>{busy?'融合中…':'AI 融合扩展'}</button>:<button className="button primary" disabled={!selected.length} onClick={moveSelected}>多选加入灵感库</button>}</div><div className="cards-grid">{ideas.map(idea=><InspirationCard key={idea.id} entity={idea} checked={checked.includes(idea.id)} onToggle={()=>setChecked(ids=>ids.includes(idea.id)?ids.filter(id=>id!==idea.id):[...ids,idea.id])}/>) }{!ideas.length&&<div className="empty-state wide"><Lightbulb size={28}/><h3>{page==='灵感库'?'先从分类页选入灵感':'这里还没有灵感'}</h3><button className="button primary" onClick={create}>写下第一条</button></div>}</div>{page==='灵感库'&&fused&&<section className="paper-page fusion-result"><div className="panel-heading"><h3>融合扩展提案</h3><button className="button primary" onClick={()=>{app.add('inspiration','融合灵感方案',fused,{category:'开书想法',workId:app.workId,meta:{inLibrary:true,sourceIds:checked}});setFused('');setChecked([]);app.notify('已保存到灵感库');}}>保存为新灵感</button></div><textarea value={fused} onChange={e=>setFused(e.target.value)}/></section>}</>;
}
function InspirationCard({entity,checked,onToggle}:{entity:Entity;checked:boolean;onToggle():void}){
  const app=useApp();const [editing,setEditing]=useState(false);
  return <article className={`entity-card inspiration-card ${checked?'selected':''}`}><div className="card-top"><label className="check-inline"><input type="checkbox" checked={checked} onChange={onToggle}/><span className="tiny-label">{entity.category??'灵感'}</span></label><button className="icon-button danger" title="移入垃圾箱" onClick={()=>app.trash(entity.id)}><Trash2 size={15}/></button></div>{editing?<><input value={entity.title} onChange={e=>app.update(entity.id,{title:e.target.value})}/><textarea value={entity.content} onChange={e=>app.update(entity.id,{content:e.target.value})}/><label>分类<select value={entity.category??'其他'} onChange={e=>app.update(entity.id,{category:e.target.value})}>{ideaCategories.filter(c=>!['全部','灵感库'].includes(c)).map(c=><option key={c}>{c}</option>)}</select></label><button className="button" onClick={()=>setEditing(false)}>完成</button></>:<><h3>{entity.title}</h3><p>{entity.content||'点击编辑补充内容。'}</p><div className="action-row">{Boolean(entity.meta.inLibrary)&&<small>已入灵感库</small>}<button className="text-button" onClick={()=>setEditing(true)}>编辑<ArrowRight size={14}/></button>{Boolean(entity.meta.inLibrary)&&<button className="text-button" onClick={()=>app.update(entity.id,{meta:{...entity.meta,inLibrary:false}})}>移出灵感库</button>}</div></>}</article>;
}

const trashKinds: { label: string; kinds: EntityKind[]; categories?: string[] }[] = [
  {label:'全部',kinds:[]},
  {label:'作品与章节',kinds:['work','volume','chapter']},
  {label:'创作资料',kinds:['outline','fineOutline','setting','memory','inspiration','split']},
  {label:'仓库与配置',kinds:['style','agent','skill','prompt','provider']},
  {label:'改编与手册',kinds:['adaptation','roleBook','clue','manual']},
  {label:'审校与润笔',kinds:['review','snapshot','attachment'],categories:['润笔记录','审校记录','润笔草稿','审校草稿','润笔素材','审校素材']},
  {label:'炼丹炉',kinds:['attachment'],categories:['炼丹炉记录','炼丹炉草稿']},
  {label:'流程与会话',kinds:['workflow','chat']},
  {label:'其他导入',kinds:['attachment']}
];
function TrashPage() {
  const app = useApp(); const [filter,setFilter]=useState('全部'); const [query,setQuery]=useState('');
  const group = trashKinds.find(g=>g.label===filter)!;
  const items = listEntities(app.state,{trash:true}).filter(e=>(!group.kinds.length||group.kinds.includes(e.kind)) && (!group.categories||group.categories.includes(e.category??'')) && (group.label!=='其他导入'||!['润笔记录','审校记录','润笔草稿','审校草稿','润笔素材','审校素材','炼丹炉记录','炼丹炉草稿'].includes(e.category??'')) && e.title.includes(query));
  const handleRestore=async(e:Entity)=>{ try { app.restore(e.id); } catch { const name=await app.ask('恢复位置有重名，请输入新名称',`${e.title}（恢复）`); if(name){app.update(e.id,{title:name}); app.notify('已改名，请再次点击恢复');} } };
  return <><SectionHead overline="RECOVERY / TRASH" title="垃圾箱" subtitle="所有删除内容先来到这里。按类别找回；永久删除需要再次确认。"/><div className="category-tabs">{trashKinds.map(g=><button key={g.label} className={filter===g.label?'selected':''} onClick={()=>setFilter(g.label)}>{g.label}</button>)}</div><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索已删除内容"/></div><div className="trash-list">{items.map(e=><div key={e.id} className="trash-row"><div><span className="tiny-label">{e.kind} · {e.deletedAt?.slice(0,10)}</span><strong>{e.title}</strong><small>{e.workId ? `所属作品：${app.state.entities.find(w=>w.id===e.workId)?.title??'未知'}`:'全局内容'} · 原分类：{e.category??'—'}</small></div><div className="action-row"><button className="button" onClick={()=>handleRestore(e)}><RotateCcw size={15}/>恢复</button><button className="button danger" onClick={()=>app.purge(e.id)}><Trash2 size={15}/>永久删除</button></div></div>)}{!items.length&&<div className="empty-state"><h3>这个分类的垃圾箱是空的</h3><p>删除的章节、仓库条目和资料会按分类出现在这里。</p></div>}</div></>;
}

function SearchPage() {
  const app=useApp(); const [q,setQ]=useState(''); const items=app.state.entities.filter(e=>!e.deletedAt && q && `${e.title}${e.content}`.includes(q)).slice(0,50);
  return <><SectionHead overline="SEARCH / WORKSPACE" title="搜索工作台" subtitle="搜索作品、章节、角色、灵感和设定。"/><div className="search-box large"><Search size={20}/><input autoFocus placeholder="输入关键词" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="trash-list">{items.map(e=><button key={e.id} className="search-result" onClick={()=>app.navigate(e.workId?routeFor(e.workId,e.kind==='chapter'?'body':'settings',e.kind==='chapter'?e.id:undefined):'/library')}><span>{e.title}</span><small>{e.kind}</small><ArrowRight size={15}/></button>)}</div></>;
}
