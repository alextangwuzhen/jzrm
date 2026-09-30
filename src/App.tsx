import { useEffect, useMemo, useState } from 'react';
import { BookOpen, BookText, Boxes, BrainCircuit, ChartNoAxesCombined, ChevronDown, ChevronRight, Clapperboard, Home, LibraryBig, Lightbulb, ListTree, MessageCircle, PenLine, Search, Settings2, Sparkles, Trash2, UsersRound, WandSparkles, X } from 'lucide-react';
import { AppContext } from './context';
import { createEntity, createInitialState, moveToTrash, purgeEntity, restoreEntity, updateEntity, listEntities, type AppState, type Entity, type EntityKind, type NewEntity } from './store';
import { parseRoute, routeFor } from './routes';
import { platform } from './platform';
import { GlobalPage } from './GlobalPage';
import { WorkPageView } from './WorkPage';
import { AssistantDrawer } from './Drawers';
import { BrainstormDrawer } from './BrainstormDrawer';
import { seedStyles } from './styles';
import { migrateInvalidModelIds, migrateTimelineTables } from './migrations';
import { seedPrompts } from './promptPresets';
import { seedSkills } from './skillPresets';
import { syncInspiration } from './inspirationSync';
import { migrateLegacyDiagrams } from './diagramMigration';
import { seedRestrictions } from './restrictions';
import { migrateSettingCards } from './cardsMigration';
import { seedReaderAgents } from './readerAgents';
import { APP_VERSION } from './version';

const mainLinks = [
  ['/', '首页', Home], ['/library', '作品库', LibraryBig], ['/reader', '阅读空间', BookOpen], ['/split', '作品拆解', BookText],
  ['/inspiration', '灵感泡泡', Lightbulb], ['/names', '捏脸工坊', Sparkles], ['/adaptation', '小说改编剧本杀', Clapperboard],
  ['/review', '审查修改', ChartNoAxesCombined], ['/polish', 'AI 润笔', WandSparkles], ['/styles', '文风仓库', Boxes],
  ['/agents', 'Agent 技能树', BrainCircuit], ['/ai-config', 'AI 配置', Settings2], ['/trash', '垃圾箱', Trash2]
] as const;

const workLinks = [
  ['body', '正文', PenLine], ['outline', '大纲', ListTree], ['settings', '设定', BookText], ['memory', '记忆', BrainCircuit]
] as const;

function readHash() { return decodeURI(window.location.hash.replace(/^#/, '') || '/'); }

export default function App() {
  const [state, setState] = useState<AppState>(createInitialState);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState(readHash);
  const [toast, setToast] = useState('');
  const [drawer, setDrawer] = useState<'assistant' | 'brainstorm' | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [workMenuOpen, setWorkMenuOpen] = useState(true);
  const [dialog, setDialog] = useState<{ question: string; value: string; type: 'ask' | 'confirm'; resolve: (value: string | boolean | null) => void } | null>(null);

  useEffect(() => { platform().load().then(s => { setState(seedReaderAgents(seedRestrictions(seedSkills(seedPrompts(seedStyles(migrateSettingCards(migrateLegacyDiagrams(migrateTimelineTables(migrateInvalidModelIds(s)))))))))); setReady(true); }).catch(e => { setReady(true); setToast(String(e)); }); }, []);
  useEffect(() => { if (!ready) return; const id = window.setTimeout(() => platform().save(state).catch(e => setToast(`保存失败：${String(e)}`)), 300); return () => clearTimeout(id); }, [state, ready]);
  useEffect(() => { const handler = () => setRoute(readHash()); window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 4200); return () => clearTimeout(id); }, [toast]);
  useEffect(() => { document.documentElement.dataset.theme = state.preferences.theme || 'light'; }, [state.preferences.theme]);

  const parsed = parseRoute(route);
  const workId = parsed.workId;
  const work = state.entities.find(e => e.id === workId && !e.deletedAt);
  const activeWorkId = workId ?? state.preferences.activeWorkId;
  const navigate = (path: string) => {
    const nextWorkId = parseRoute(path).workId;
    if (nextWorkId) setState(s => ({ ...s, preferences: { ...s.preferences, activeWorkId: nextWorkId } }));
    window.location.hash = `#${path}`;
    setRoute(path);
  };
  const add = (kind: EntityKind, title: string, content = '', extra: Partial<NewEntity> = {}): Entity => {
    const input = { id: crypto.randomUUID(), kind, title: title.trim() || '未命名', content, ...extra } as NewEntity;
    setState(s => { const next=createEntity(s,input); return kind==='inspiration'?syncInspiration(next,next.entities[next.entities.length-1]):next; });
    return { ...input, content: input.content ?? '', meta: input.meta ?? {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Entity;
  };
  const update = (id: string, patch: Partial<Pick<Entity, 'title' | 'content' | 'category' | 'meta' | 'parentId'>>) => setState(s => { const next=updateEntity(s,id,patch);const item=next.entities.find(e=>e.id===id);return item?.kind==='inspiration'?syncInspiration(next,item):next; });
  const trash = (id: string) => {
    setState(s => {
      const next = moveToTrash(s, id);
      return s.preferences.activeWorkId === id ? { ...next, preferences: { ...next.preferences, activeWorkId: undefined } } : next;
    });
    if (workId === id) navigate('/library');
    setToast('已移入垃圾箱，可随时恢复');
  };
  const restore = (id: string) => { const next = restoreEntity(state, id); setState(next); setToast('已恢复到原位置'); };
  const ask = (question: string, defaultValue = ''): Promise<string | null> => new Promise(resolve => setDialog({ question, value: defaultValue, type: 'ask', resolve: value => resolve(value as string | null) }));
  const confirm = (question: string): Promise<boolean> => new Promise(resolve => setDialog({ question, value: '', type: 'confirm', resolve: value => resolve(Boolean(value)) }));
  const purge = async (id: string) => { if (!await confirm('永久删除后无法从 JZRM 垃圾箱恢复。确定删除吗？')) return; setState(s => purgeEntity(s, id)); setToast('已永久删除'); };
  const replaceState = (next: AppState) => setState(next);
  const notify = (message: string) => setToast(message);
  const openAi = (prompt = '') => { setAssistantPrompt(prompt); setDrawer('assistant'); };
  const ctx = useMemo(() => ({ state, route, workId: activeWorkId, navigate, add, update, trash, restore, purge, replaceState, notify, openAi, ask, confirm }), [state, route, activeWorkId]);
  const pageTitle = work ? `${work.title} · ${({ body: '正文', outline: '大纲', settings: '设定', memory: '记忆', 'fine-outline': '细纲' } as Record<string, string>)[parsed.page] ?? parsed.page}` : mainLinks.find(([url]) => url === `/${parsed.page}`)?.[1] ?? ({help:'使用说明',settings:'设置',search:'搜索工作台'} as Record<string,string>)[parsed.page] ?? '创作工作台';
  const works = listEntities(state, { kind: 'work' });

  if (!ready) return <div className="loading-screen"><span className="logo-mark">J</span><p>正在打开 JZRM · {APP_VERSION}…</p></div>;
  return <AppContext.Provider value={ctx}>
    <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><img src={new URL('./jzrm-icon.png',import.meta.url).href} alt="金毛剪影" /></div><div><strong>JZRM</strong><small>故事与剧本创作空间 · {APP_VERSION}</small></div><button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen?'收起侧栏':'展开侧栏'} aria-label={sidebarOpen?'收起侧栏':'展开侧栏'}><ChevronDown size={16}/></button></div>
        <button className="search-shortcut" onClick={() => navigate('/search')}><Search size={15}/><span>搜索工作台</span><kbd>⌘K</kbd></button>
        {work ? <><div className="sidebar-group-label">当前作品</div><button className="work-back" onClick={() => navigate('/library')}><ChevronRight size={16} className="rotate-180"/>返回作品库</button><div className="work-title-mini">{work.title}</div><button className="sidebar-section" onClick={() => setWorkMenuOpen(!workMenuOpen)}><span>创作工作区</span>{workMenuOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>{workMenuOpen && workLinks.map(([key, label, Icon]) => <button key={key} className={`nav-item sub-item ${parsed.page === key ? 'active' : ''}`} onClick={() => navigate(routeFor(work.id, key))}><Icon size={17}/><span>{label}</span></button>)}<div className="sidebar-group-label">作品工具</div><button className="nav-item sub-item" onClick={() => navigate(`/review?work=${work.id}`)}><ChartNoAxesCombined size={17}/>审查修改</button><button className="nav-item sub-item" onClick={() => navigate(`/adaptation?work=${work.id}`)}><Clapperboard size={17}/>剧本杀改编</button></> : <><div className="sidebar-group-label">主菜单</div>{mainLinks.map(([url, label, Icon]) => <button key={url} className={`nav-item ${route.split('?')[0] === url ? 'active' : ''}`} onClick={() => navigate(url)}><Icon size={18}/><span>{label}</span></button>)}</>}
        <div className="sidebar-bottom"><button onClick={() => navigate('/settings')}><Settings2 size={17}/>设置</button></div>
      </aside>
      <div className="main-frame">
        <header className="topbar"><div><span className="eyebrow">JZRM / CREATIVE DESK</span><h1>{pageTitle}</h1></div><div className="top-actions"><select aria-label="切换作品" value={activeWorkId ?? ''} onChange={e => { const id = e.target.value; setState(s => ({ ...s, preferences: { ...s.preferences, activeWorkId: id || undefined } })); if (id) navigate(routeFor(id, 'body')); }}><option value="">选择作品</option>{works.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}</select><button onClick={() => setDrawer('brainstorm')}><UsersRound size={17}/>脑暴</button><button className="top-primary" onClick={() => setDrawer('assistant')}><MessageCircle size={17}/>助手</button></div></header>
        <main className="page-content">{work ? <WorkPageView work={work} page={parsed.page} category={parsed.category}/> : <GlobalPage page={parsed.page} category={parsed.category}/>}</main>
      </div>
      {drawer === 'assistant' && <AssistantDrawer initialPrompt={assistantPrompt} onClose={() => { setDrawer(null); setAssistantPrompt(''); }}/ >}
      {drawer === 'brainstorm' && <BrainstormDrawer onClose={() => setDrawer(null)}/>}
      {toast && <div className="toast"><X size={14} onClick={() => setToast('')}/>{toast}</div>}
      {dialog && <div className="modal-backdrop" onClick={() => { dialog.resolve(dialog.type === 'confirm' ? false : null); setDialog(null); }}><div className="modal-card app-dialog" onClick={e => e.stopPropagation()}><h3>{dialog.type === 'confirm' ? '确认操作' : '填写信息'}</h3><p>{dialog.question}</p>{dialog.type === 'ask' && <input autoFocus value={dialog.value} onChange={e => setDialog({ ...dialog, value: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { dialog.resolve(dialog.value.trim() || null); setDialog(null); } }}/>}<div className="action-row dialog-actions"><button className="button" onClick={() => { dialog.resolve(dialog.type === 'confirm' ? false : null); setDialog(null); }}>取消</button><button className="button primary" onClick={() => { dialog.resolve(dialog.type === 'confirm' ? true : dialog.value.trim() || null); setDialog(null); }}>确定</button></div></div></div>}
    </div>
  </AppContext.Provider>;
}
