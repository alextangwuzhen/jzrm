import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, FilePlus2, Lightbulb, Plus, RotateCcw, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import { useApp } from './context';
import { listEntities, type Entity, type EntityKind } from './store';
import { routeFor, settingCategories } from './routes';
import { platform } from './platform';
import { parseSettingDocument } from './settingImport';
import { makeDiagramSvg, svgDataUrl } from './diagram';
import { WorldPage } from './WorldPage';
import { EmotionPage } from './EmotionPage';
import { TimelinePage } from './TimelinePage';
import { SettingCardsPage } from './SettingCardsPage';
import { CharactersPage } from './CharactersPage';
import { ForeshadowPage } from './ForeshadowPage';
import { DiagramViewer } from './DiagramViewer';

const labels: Record<string, string> = {
  overview: '设定概览', characters: '人物', emotion: '情绪', world: '背景与世界观', map: '地图与地点', timeline: '时间线', foreshadow: '伏笔追踪', style: '文风',
  facts: '事实关键词', taboo: '禁忌词', words: '限制词', sentence: '限制句式', semantic: '限制语义', scene: '限制情景'
};
const memoryCategories = ['facts', 'taboo', 'words', 'sentence', 'semantic', 'scene'];

export function WorkPageView({ work, page, category }: { work: Entity; page: string; category?: string }) {
  const app = useApp();
  const importSettings=async()=>{try{const file=await platform().importText();if(!file)return;app.add('attachment',file.name,file.text,{workId:work.id,category:'设定原件'});const sections=parseSettingDocument(file.text);for(const section of sections)app.add(section.kind,section.title,section.content,{workId:work.id,parentId:work.id,category:section.category,meta:section.meta});app.notify(`已导入 ${file.name}，整理出 ${sections.length} 条可编辑资料`);}catch(e){app.notify(String(e));}};
  if (page === 'body') return <BodyPage work={work} chapterId={category}/>;
  if (page === 'outline') return <StructuredPage work={work} kind="outline" title="小说大纲" subtitle="从总纲到卷纲、章纲，按层级规划故事。"/>;
  if (page === 'fine-outline') return <StructuredPage work={work} kind="fineOutline" title="小说大纲" subtitle="从总纲逐级展开到章节细纲。"/>;
  if (page === 'settings') {
    const selected = settingCategories.includes(category as typeof settingCategories[number]) ? category! : 'overview';
    return <><PageIntro title="作品设定" subtitle="人物、情绪、背景、地图、时间线分级管理，创作时自动取用同一作品的资料。" action={<div className="action-row"><button className="button" onClick={importSettings}><FilePlus2 size={16}/>导入设定文档</button><button className="button" onClick={() => app.openAi(`请从当前作品「${work.title}」的正文提炼人物、情绪、背景、地点和时间线。先列候选事实与原文证据，不要直接写入设定。`)}><Sparkles size={16}/>AI 提炼</button></div>}/><div className="category-tabs">{settingCategories.map(key => <button key={key} className={selected === key ? 'selected' : ''} onClick={() => app.navigate(routeFor(work.id, 'settings', key))}>{labels[key]}</button>)}</div>{selected === 'overview' ? <SettingsOverview work={work}/> : selected==='world'?<WorldPage work={work}/>:selected==='emotion'?<EmotionPage work={work}/>:selected==='timeline'?<TimelinePage work={work}/>:selected === 'characters' ? <CharactersPage work={work}/> : selected === 'map' ? <SettingCardsPage work={work} type="map"/> : selected === 'foreshadow' ? <ForeshadowPage work={work}/> : <Collection work={work} kind="setting" category={selected} title={labels[selected]} hint={settingHint(selected)}/>}</>;
  }
  if (page === 'memory') {
    const selected = memoryCategories.includes(category ?? '') ? category! : 'facts';
    return <><PageIntro title="创作记忆" subtitle="把必须遵守的事实与禁用表达写成可编辑规则，按作品、角色和章节约束 AI。" action={<button className="button" onClick={() => app.openAi(`请分析作品「${work.title}」现有内容，提出关键词、事实、禁忌词、限制词、限制句式与限制情景的候选规则。附原文依据，不要直接保存。`)}><Sparkles size={16}/>从正文提炼</button>}/><div className="category-tabs">{memoryCategories.map(key => <button key={key} className={selected === key ? 'selected' : ''} onClick={() => app.navigate(routeFor(work.id, 'memory', key))}>{labels[key]}</button>)}</div><Collection work={work} kind="memory" category={selected} title={labels[selected]} hint="每一条规则都可编辑、删除，并用于创作和审校的上下文。"/>{selected === 'sentence' && <div className="info-card"><strong>减少模板化表达预设</strong><p>可选择加入：反复使用“不是……而是……”，段尾重复总结，空泛情绪标签，排比句过密，感官词堆叠，角色对话均使用同一语气。</p><button className="button" onClick={() => ['避免反复使用“不是……而是……”','避免每段末尾总结主题','避免空泛情绪标签','避免无意义排比和感官堆叠','让角色对话具有不同声线'].forEach(title => app.add('memory', title, '', { workId: work.id, category: 'sentence', parentId: work.id }))}>多选预设加入</button></div>}</>;
  }
  return <div className="empty-state"><h2>页面正在整理</h2><button onClick={() => app.navigate(routeFor(work.id, 'body'))}>返回正文</button></div>;
}

function settingHint(category: string) {
  const hints: Record<string, string> = { characters: '建立角色档案、声线、动机、关系与出场。', emotion: '记录角色弧线和章节情绪目标。', world: '世界基础、势力、能力、法则、社会、科技、文化都可以新增卡片。', map: '用地点卡记录地图事实；绘制图片时由生图模型制作底图。', timeline: '按现实时间整理事件，并拖动调整先后。', foreshadow: '标记伏笔的埋设、揭示与回收。', style: '保存文风参数，也可关联文风仓库中的包。' };
  return hints[category] ?? '';
}

function PageIntro({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><span className="eyebrow">WORKSPACE / STORY</span><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

function BodyPage({ work, chapterId }: { work: Entity; chapterId?: string }) {
  const app = useApp();
  const volumes = listEntities(app.state, { kind: 'volume', workId: work.id });
  const chapters = listEntities(app.state, { kind: 'chapter', workId: work.id });
  const chapter = chapters.find(c => c.id === chapterId) ?? chapters[0];
  const [showTools, setShowTools] = useState(true);
  const addVolume = async () => { const name = await app.ask('卷名', `第 ${volumes.length + 1} 卷`); if (name) app.add('volume', name, '', { workId: work.id, parentId: work.id }); };
  const addChapter = async (parentId?: string) => {
    const title = await app.ask('章节标题', `第 ${chapters.length + 1} 章`);
    if (!title) return;
    let volumeId = parentId ?? volumes[0]?.id;
    if (!volumeId) volumeId = app.add('volume', '第 1 卷', '', { workId: work.id, parentId: work.id }).id;
    const next = app.add('chapter', title, '', { workId: work.id, parentId: volumeId });
    app.navigate(routeFor(work.id, 'body', next.id));
  };
  const currentIndex = chapter ? chapters.findIndex(c => c.id === chapter.id) : -1;
  const exportWork = async (format: 'txt' | 'docx' | 'pdf') => {
    try { await platform().exportFile({ title: work.title, content: chapters.map(c => `${c.title}\n\n${c.content}`).join('\n\n'), format }); } catch (e) { app.notify(String(e)); }
  };
  return <><PageIntro title="正文创作" subtitle="卷章目录、正文编辑与 AI 辅助在这里衔接；你的修改自动保存。" action={<div className="action-row"><button className="button" onClick={addVolume}><Plus size={16}/>新建卷</button><button className="button primary" onClick={() => addChapter()}><FilePlus2 size={16}/>新建章节</button></div>}/><div className="writing-layout"><aside className="chapter-tree"><div className="panel-heading"><strong>目录</strong><span>{chapters.length} 章</span></div>{volumes.map(volume => <div key={volume.id} className="volume-block"><div className="volume-heading"><BookOpen size={16}/><strong>{volume.title}</strong><button className="icon-button" title="添加章节" onClick={() => addChapter(volume.id)}><Plus size={14}/></button><button className="icon-button danger" title="删除卷" onClick={() => app.trash(volume.id)}><Trash2 size={14}/></button></div>{chapters.filter(c => c.parentId === volume.id).map(c => <button key={c.id} className={`chapter-link ${chapter?.id === c.id ? 'active' : ''}`} onClick={() => app.navigate(routeFor(work.id, 'body', c.id))}><span>{c.title}</span><small>{c.content.length} 字</small></button>)}</div>)}{!volumes.length && <div className="empty-small">还没有卷章。点击新建章节开始。</div>}</aside><section className="editor-panel">{chapter ? <><div className="editor-topline"><span>第 {currentIndex + 1} / {chapters.length} 章 · {chapter.content.replace(/\s/g, '').length} 字</span><div className="action-row"><button className="icon-button" disabled={currentIndex <= 0} onClick={() => app.navigate(routeFor(work.id, 'body', chapters[currentIndex - 1].id))} title="上一章"><ArrowLeft size={16}/></button><button className="icon-button" disabled={currentIndex >= chapters.length - 1} onClick={() => app.navigate(routeFor(work.id, 'body', chapters[currentIndex + 1].id))} title="下一章"><ArrowRight size={16}/></button><button className="icon-button danger" title="删除章节" onClick={() => { app.trash(chapter.id); app.navigate(routeFor(work.id, 'body')); }}><Trash2 size={16}/></button></div></div><input className="chapter-title-input" value={chapter.title} onChange={e => app.update(chapter.id, { title: e.target.value })}/><textarea className="chapter-textarea" value={chapter.content} placeholder="开始写下这一章……" onChange={e => app.update(chapter.id, { content: e.target.value })}/><div className="editor-footer"><span>自动保存 · 作品内资料会在 AI 创作时作为约束</span><div className="action-row"><button className="button" onClick={() => app.navigate('/reader')}><BookOpen size={15}/>阅读</button><button className="button" onClick={() => app.openAi(`请依据当前作品设定与记忆规则，续写「${chapter.title}」。原文：\n${chapter.content}`)}><WandSparkles size={15}/>续写</button><button className="button primary" onClick={() => app.navigate('/review')}><Sparkles size={15}/>审校</button></div></div></> : <div className="empty-state"><h3>选择左侧章节开始写作</h3><button className="button primary" onClick={() => addChapter()}>创建第一章</button></div>}</section>{showTools && <aside className="writing-tools"><div className="panel-heading"><strong>创作助手</strong><button className="icon-button" onClick={() => setShowTools(false)}><ChevronRight size={15}/></button></div><p>当前作品的设定、记忆、细纲会在 AI 任务中一起参考。</p><button className="tool-card" onClick={() => app.navigate(routeFor(work.id, 'outline'))}><ListIcon/>查看大纲<ChevronRight size={15}/></button><button className="tool-card" onClick={() => app.navigate(routeFor(work.id, 'settings'))}><ListIcon/>查看设定<ChevronRight size={15}/></button><button className="tool-card" onClick={() => app.navigate(routeFor(work.id, 'memory'))}><ListIcon/>查看记忆<ChevronRight size={15}/></button><button className="tool-card" onClick={() => app.openAi('请根据当前作品进度，建议下一步最值得完成的一项创作任务，并指出应调用的 Agent。')}><Lightbulb size={16}/>主管建议<ChevronRight size={15}/></button><div className="export-box"><strong>导出正文</strong><div className="action-row">{(['txt','docx','pdf'] as const).map(format => <button key={format} onClick={() => exportWork(format)}>{format.toUpperCase()}</button>)}</div></div></aside>}{!showTools && <button className="tools-restore" onClick={() => setShowTools(true)}><RotateCcw size={15}/>显示助手</button>}</div></>;
}

function ListIcon() { return <ChevronRight size={15}/>; }

function StructuredPage({ work, kind, title, subtitle }: { work: Entity; kind: 'outline' | 'fineOutline'; title: string; subtitle: string }) {
  const app = useApp();
  const categories = kind === 'outline' ? ['总纲','卷纲','章纲'] : ['卷细纲','章细纲','场景节拍'];
  const [selected, setSelected] = useState(categories[0]);
  return <><PageIntro title={title} subtitle={subtitle} action={<div className="action-row"><button className="button" onClick={() => app.openAi(`请从当前作品「${work.title}」的灵感和正文提炼${title}，按${categories.join('、')}组织，标出缺口和建议；不要直接写入。`)}><Sparkles size={16}/>一键提炼</button></div>}/><div className="category-tabs"><button className={kind==='outline'?'selected':''} onClick={()=>app.navigate(routeFor(work.id,'outline'))}>大纲</button><button className={kind==='fineOutline'?'selected':''} onClick={()=>app.navigate(routeFor(work.id,'fine-outline'))}>细纲</button></div><div className="category-tabs">{categories.map(category => <button key={category} className={selected === category ? 'selected' : ''} onClick={() => setSelected(category)}>{category}</button>)}</div><Collection work={work} kind={kind} category={selected} title={selected} hint={kind === 'outline' ? '可从总纲逐级拆到章纲。' : '把每章拆成场景和关键节拍，点击章节可返回正文。'}/></>;
}

function SettingsOverview({ work }: { work: Entity }) {
  const app = useApp();
  return <div className="overview-grid">{settingCategories.filter(x => x !== 'overview').map(category => { const count = listEntities(app.state, { kind: 'setting', workId: work.id, category }).length; return <button key={category} className="overview-card" onClick={() => app.navigate(routeFor(work.id, 'settings', category))}><span className="overview-icon">✦</span><strong>{labels[category]}</strong><small>{count} 条资料</small><p>{settingHint(category)}</p><ChevronRight size={16}/></button>; })}</div>;
}

function Collection({ work, kind, category, title, hint }: { work: Entity; kind: EntityKind; category: string; title: string; hint: string }) {
  const app = useApp();
  const items = listEntities(app.state, { kind, workId: work.id, category });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing,setDrawing]=useState(false);
  const [viewing,setViewing]=useState(false);
  const selected = items.find(i => i.id === selectedId) ?? items[0];
  const add = async () => { const name = await app.ask(`新增${title}标题`); if (!name) return; const item = app.add(kind, name, '', { workId: work.id, parentId: work.id, category }); setSelectedId(item.id); };
  const diagramType=({characters:'人物关系网图',map:'世界地图',timeline:'故事时间轴图'} as Record<string,string>)[category];
  const generateDiagram=async()=>{
    const facts=items.filter(i=>!i.meta.imageData).map(i=>`${i.title}：${i.content}`).join('\n').slice(0,12000);
    if(!facts.trim()){app.notify('请先添加可用于绘图的设定资料');return;}
    setDrawing(true);
    try {
      const title=`${work.title} · ${diagramType}`;
      const svg=makeDiagramSvg(title,items,category as 'characters'|'map'|'timeline');
      const imageData=svgDataUrl(svg);
      const item=app.add('setting',`${diagramType} · ${new Date().toLocaleDateString('zh-CN')}`,`根据本作品现有${title}资料排版生成，可回到资料卡修改后重新生成。`,{workId:work.id,parentId:work.id,category,meta:{imageData,diagramType,imageFormat:'svg',diagramVersion:4}});
      setSelectedId(item.id);
      app.notify('清晰图已生成，可在设定和阅读空间查看');
    } catch(e) { app.notify(String(e)); } finally { setDrawing(false); }
  };
  return <><div className="collection-layout"><div className="collection-list"><div className="panel-heading"><strong>{title}</strong><div className="action-row">{kind==='setting'&&diagramType&&<button className="button" disabled={drawing} onClick={generateDiagram}><Sparkles size={14}/>{drawing?'生成中…':`生成${diagramType}`}</button>}<button className="icon-button" title="新增" onClick={add}><Plus size={17}/></button></div></div><p className="muted">{hint}</p>{items.map(item => <button key={item.id} className={`collection-row ${selected?.id === item.id ? 'active' : ''}`} onClick={() => setSelectedId(item.id)}><span>{item.title}</span><ChevronRight size={14}/></button>)}{!items.length && <div className="empty-small">这里还没有内容。可手动新增，也可让 AI 提炼候选。</div>}</div><div className="collection-detail">{selected ? <><div className="panel-heading"><span>编辑 {title}</span><button className="icon-button danger" onClick={() => { app.trash(selected.id); setSelectedId(null); }} title="移入垃圾箱"><Trash2 size={16}/></button></div><label>标题<input value={selected.title} onChange={e => app.update(selected.id, { title: e.target.value })}/></label><label>内容<textarea value={selected.content} onChange={e => app.update(selected.id, { content: e.target.value })} placeholder="写下可供创作使用的具体事实、目标与限制……"/></label>{typeof selected.meta.imageData==='string'&&<div className="diagram-preview"><button className="figure-open" onClick={()=>setViewing(true)} title="查看大图"><img src={selected.meta.imageData} alt={selected.title}/></button><a className="button" href={selected.meta.imageData} download={`${selected.title}.${selected.meta.imageFormat==='svg'?'svg':'png'}`}>下载图片</a></div>}<div className="detail-footer"><span>每次修改自动保存</span><button className="button" onClick={() => app.openAi(`请优化作品「${work.title}」的${title}条目「${selected.title}」。现有内容：${selected.content}。请给修改提案并说明理由，不要直接覆盖。`)}><WandSparkles size={15}/>AI 优化</button></div></> : <div className="empty-state"><h3>选择或新增一条{title}</h3><button className="button primary" onClick={add}><Plus size={15}/>新增</button></div>}</div></div>{viewing&&selected&&typeof selected.meta.imageData==='string'&&<DiagramViewer src={selected.meta.imageData} title={selected.title} onClose={()=>setViewing(false)}/>}</>;
}
