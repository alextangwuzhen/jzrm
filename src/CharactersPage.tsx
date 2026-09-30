import { useMemo, useState } from 'react';
import { ImagePlus, Plus, Search, Sparkles, Trash2, UsersRound } from 'lucide-react';
import { useApp } from './context';
import { listEntities, type Entity } from './store';
import { modelFromProvider, pickModel, workContext } from './ai';
import { platform } from './platform';
import { relationshipDiagramSvg, svgDataUrl } from './diagram';
import { DiagramViewer } from './DiagramViewer';
import {
  characterBrief, characterSummary, emptyProfile, isCharacterCard,
  readGroup, readProfile, readRelations,
  type CharacterProfile, type CharacterRelation
} from './characters';

type EditorState = { id?: string; profile: CharacterProfile; relations: CharacterRelation[]; group: string; coverImage: string; coverSource: string };

export function CharactersPage({ work }: { work: Entity }) {
  const app = useApp();
  const all = listEntities(app.state, { kind: 'setting', workId: work.id, category: 'characters' });
  const cards = all.filter(isCharacterCard);
  const figures = all.filter(e => typeof e.meta.imageData === 'string');
  const sources = all.filter(e => !e.meta.imageData && (e.title === '人物档案' || e.title === '人物关系'));

  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('全部');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState('');
  const [viewing, setViewing] = useState('');
  const [mergePanel, setMergePanel] = useState(false);

  const groups = useMemo(() => ['未分组', ...Array.from(new Set(cards.map(c => readGroup(c.meta)))).filter(g => g !== '未分组')], [cards]);
  const filtered = cards.filter(c => {
    const text = `${c.title}${c.content}${characterBrief(readProfile(c.meta))}`;
    const inGroup = group === '全部' || readGroup(c.meta) === group;
    return inGroup && (!query.trim() || text.includes(query.trim()));
  });

  const openAdd = () => setEditor({ profile: { ...emptyProfile }, relations: [], group: '未分组', coverImage: '', coverSource: '' });
  const openEdit = (item: Entity) => {
    const profile = readProfile(item.meta);
    if (!profile.name) profile.name = item.title;
    setEditor({
      id: item.id, profile, relations: readRelations(item.meta),
      group: readGroup(item.meta), coverImage: String(item.meta.coverImage ?? ''), coverSource: String(item.meta.coverSource ?? '')
    });
  };

  const imageModel = () => {
    const m = modelFromProvider(pickModel(app.state.entities, '生图', 'image'));
    if (!m) app.notify('先在 AI 配置中绑定可用的生图模型');
    return m;
  };
  const importImage = async () => {
    if (!editor) return;
    try {
      const image = await platform().importImage();
      if (image) setEditor({ ...editor, coverImage: image.dataUrl, coverSource: image.name });
    } catch (e) { app.notify(String(e)); }
  };
  const generateImage = async () => {
    if (!editor) return;
    const m = imageModel();
    if (!m) return;
    setBusy('image');
    try {
      const prompt = `Novel character portrait, Chinese fantasy watercolor illustration, expressive face and costume, refined painterly details, warm ivory paper texture. Character: ${editor.profile.name || '主角'}. Character facts: ${characterSummary(editor.profile, editor.relations).slice(0, 1200)}. Single character only. No letters, captions, words, symbols, charts or borders.`;
      const image = await platform().generateImage({ ...m, prompt });
      setEditor({ ...editor, coverImage: image, coverSource: 'AI 生成' });
    } catch (e) { app.notify(String(e)); } finally { setBusy(''); }
  };

  const saveEditor = () => {
    if (!editor) return;
    const name = editor.profile.name.trim() || editor.profile.alias.trim();
    if (!name) { app.notify('请至少填写名字或别名'); return; }
    const profile = { ...editor.profile, name: editor.profile.name.trim() || name };
    const meta: Record<string, unknown> = {
      cardType: 'character', group: editor.group, profile, relations: editor.relations,
      coverImage: editor.coverImage, coverSource: editor.coverSource
    };
    const content = characterSummary(profile, editor.relations);
    if (editor.id) app.update(editor.id, { title: profile.name || editor.profile.name, content, meta });
    else app.add('setting', profile.name || name, content, { workId: work.id, parentId: work.id, category: 'characters', meta });
    setEditor(null);
  };

  const aiFill = async () => {
    if (!editor) return;
    if (!editor.profile.name.trim()) { app.notify('先填写角色名字，再让 AI 补全档案'); return; }
    const m = modelFromProvider(pickModel(app.state.entities, '辅助'));
    if (!m) { app.notify('请先配置辅助模型'); return; }
    setBusy('fill');
    try {
      const context = workContext(app.state.entities, work.id, app.state.preferences.contextLimit);
      const response = await platform().runAi({
        ...m,
        prompt: `为角色「${editor.profile.name}」补全档案。依据作品资料与人物知情边界，不得与现有设定冲突，也不要擅自新增神器、组织、重大身世。返回 JSON：{"alias":"别名","age":"年龄","identity":"身份","appearance":"外貌","personality":"性格","background":"背景","speechHabit":"说话习惯","arc":"角色弧光"}，只返回 JSON。\n作品资料：\n${context}`
      });
      const parsed = extractProfile(response);
      setEditor({ ...editor, profile: { ...editor.profile, ...parsed } });
      app.notify('已用 AI 补全档案，可继续修改');
    } catch (e) { app.notify(String(e)); } finally { setBusy(''); }
  };

  const drawDiagram = async () => {
    if (!cards.length) { app.notify('先添加角色'); return; }
    setBusy('diagram');
    try {
      const title = `${work.title} · 人物关系图`;
      const svg = relationshipDiagramSvg(title, all);
      app.add('setting', `人物关系图 · ${new Date().toLocaleDateString('zh-CN')}`, '根据本作品人物资料生成；连线仅来自明确的关系资料。', {
        workId: work.id, parentId: work.id, category: 'characters',
        meta: { imageData: svgDataUrl(svg), imageFormat: 'svg', diagramType: '人物关系图', diagramVersion: 6 }
      });
      figures.forEach(f => app.trash(f.id));
      app.notify('人物关系图已生成，可在阅读空间查看大图');
    } catch (e) { app.notify(String(e)); } finally { setBusy(''); }
  };

  const mergeGroups = (from: string, into: string) => {
    if (!from || !into || from === into) return;
    let count = 0;
    for (const card of cards) {
      if (readGroup(card.meta) === from) { app.update(card.id, { meta: { ...card.meta, group: into } }); count++; }
    }
    setMergePanel(false);
    setGroup('全部');
    app.notify(`已将「${from}」${count} 名角色并入「${into}」`);
  };

  return <>
    <div className="section-actions">
      <div>
        <h3>角色</h3>
        <p className="muted">分类、搜索与管理角色档案，含人际关系与人物图片；图片文字由本地排版，避免模型拼错汉字。</p>
      </div>
      <div className="action-row">
        <button className="button" disabled={Boolean(busy)} onClick={drawDiagram}><Sparkles size={15} />{busy === 'diagram' ? '绘制中…' : '绘制人物关系图'}</button>
        <button className="button" onClick={() => setMergePanel(v => !v)}><UsersRound size={15} />合并分类</button>
        <button className="button primary" onClick={openAdd}><Plus size={15} />添加角色</button>
      </div>
    </div>

    {mergePanel && <div className="paper-page merge-panel">
      <h4>合并分类</h4>
      <MergeGroups groups={groups} onMerge={mergeGroups} onClose={() => setMergePanel(false)} />
    </div>}

    <div className="search-box"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索角色名字、身份、性格或背景" /></div>
    <div className="category-tabs">
      <button className={group === '全部' ? 'selected' : ''} onClick={() => setGroup('全部')}>全部</button>
      {groups.map(g => <button key={g} className={group === g ? 'selected' : ''} onClick={() => setGroup(g)}>{g}</button>)}
    </div>

    <div className="setting-card-grid">
      {filtered.map(item => {
        const profile = readProfile(item.meta);
        const cover = String(item.meta.coverImage ?? '');
        return <article className="setting-visual-card" key={item.id} onClick={() => openEdit(item)}>
          <div className="setting-card-cover">{cover ? <img src={cover} alt={item.title} /> : <span>{readGroup(item.meta).slice(0, 1) || '角'}</span>}</div>
          <div className="setting-card-meta"><strong>{item.title}</strong><p>{characterBrief(profile)}</p></div>
          <div className="setting-card-hover"><strong>{item.title}</strong><p>{item.content || '暂无详细设定'}</p></div>
        </article>;
      })}
    </div>
    {!filtered.length && <div className="empty-small">还没有角色。可手动添加、AI 补全，或导入设定文档自动提取。</div>}

    {sources.length > 0 && <details className="setting-sources"><summary>查看导入的原始资料 · {sources.length} 份</summary>{sources.map(e => <details key={e.id}><summary>{e.title}</summary><pre>{e.content}</pre></details>)}</details>}

    {figures.length > 0 && <section className="paper-page"><h3>已生成图片</h3><div className="figure-gallery">{figures.map(f => <article key={f.id}><button className="figure-open" onClick={() => setViewing(f.id)} title="查看大图"><img src={String(f.meta.imageData)} alt={f.title} /></button><strong>{f.title}</strong><button className="icon-button danger" title="移入垃圾箱" onClick={() => app.trash(f.id)}><Trash2 size={14} /></button></article>)}</div></section>}

    {editor && <CharacterEditor editor={editor} busy={busy} names={cards.map(c => c.title)} groups={groups}
      onChange={setEditor} onImport={importImage} onGenerate={generateImage} onAiFill={aiFill}
      onSave={saveEditor} onCancel={() => setEditor(null)} />}

    {figures.find(f => f.id === viewing) && <DiagramViewer src={String(figures.find(f => f.id === viewing)!.meta.imageData)} title={figures.find(f => f.id === viewing)!.title} onClose={() => setViewing('')} />}
  </>;
}

function extractProfile(text: string): Partial<CharacterProfile> {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned) as Partial<CharacterProfile>; }
  catch {
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as Partial<CharacterProfile>;
    throw new Error('模型未返回可解析的角色档案 JSON');
  }
}

function CharacterEditor({ editor, busy, names, groups, onChange, onImport, onGenerate, onAiFill, onSave, onCancel }: {
  editor: EditorState; busy: string; names: string[]; groups: string[];
  onChange(next: EditorState): void; onImport(): void; onGenerate(): void; onAiFill(): void; onSave(): void; onCancel(): void;
}) {
  const setProfile = (patch: Partial<CharacterProfile>) => onChange({ ...editor, profile: { ...editor.profile, ...patch } });
  const setRelation = (i: number, patch: Partial<CharacterRelation>) => onChange({
    ...editor, relations: editor.relations.map((r, n) => n === i ? { ...r, ...patch } : r)
  });
  return <div className="modal-backdrop" onClick={onCancel}>
    <div className="modal-card character-editor" onClick={e => e.stopPropagation()}>
      <div className="panel-heading"><h3>{editor.id ? '编辑角色' : '添加角色'}</h3><button className="icon-button" onClick={onCancel} title="关闭">×</button></div>

      <div className="character-editor-top">
        {editor.coverImage ? <img className="setting-editor-cover" src={editor.coverImage} alt="人物图片" /> : <div className="setting-editor-cover placeholder">人物图片</div>}
        <div className="character-editor-cover-actions">
          <button className="button" onClick={onImport}><ImagePlus size={15} />导入人物图片</button>
          <button className="button" disabled={busy === 'image'} onClick={onGenerate}><Sparkles size={15} />{busy === 'image' ? '生成中…' : 'AI 生成人物图片'}</button>
        </div>
      </div>

      <div className="form-grid character-fields">
        <label>名字<input value={editor.profile.name} onChange={e => setProfile({ name: e.target.value })} placeholder="角色姓名" /></label>
        <label>别名<input value={editor.profile.alias} onChange={e => setProfile({ alias: e.target.value })} placeholder="号、小名等" /></label>
        <label>年龄<input value={editor.profile.age} onChange={e => setProfile({ age: e.target.value })} placeholder="例如 十七岁" /></label>
        <label>身份<input value={editor.profile.identity} onChange={e => setProfile({ identity: e.target.value })} placeholder="例如 守旧车站的售票员" /></label>
        <label>外貌<textarea className="small-textarea" value={editor.profile.appearance} onChange={e => setProfile({ appearance: e.target.value })} placeholder="长相、体态、常穿衣物" /></label>
        <label>性格<textarea className="small-textarea" value={editor.profile.personality} onChange={e => setProfile({ personality: e.target.value })} placeholder="内在性格、对外表现" /></label>
        <label>背景<textarea className="small-textarea" value={editor.profile.background} onChange={e => setProfile({ background: e.target.value })} placeholder="身世、经历、动机" /></label>
        <label>说话习惯<textarea className="small-textarea" value={editor.profile.speechHabit} onChange={e => setProfile({ speechHabit: e.target.value })} placeholder="口癖、句式、语气" /></label>
        <label>角色弧光<textarea className="small-textarea" value={editor.profile.arc} onChange={e => setProfile({ arc: e.target.value })} placeholder="从开始到结尾的转变" /></label>
        <label>分类<select value={editor.group} onChange={e => onChange({ ...editor, group: e.target.value })}>{groups.map(g => <option key={g} value={g}>{g}</option>)}<option value="__new">＋新建分类…</option></select></label>
      </div>
      {editor.group === '__new' && <label>新分类名称<input autoFocus placeholder="输入分类名" onBlur={e => onChange({ ...editor, group: e.target.value.trim() || '未分组' })} /></label>}

      <div className="relation-section">
        <div className="panel-heading"><h4>人际关系</h4><button className="button" onClick={() => onChange({ ...editor, relations: [...editor.relations, { target: '', relation: '', note: '' }] })}><Plus size={14} />添加关系</button></div>
        <datalist id="character-names">{names.map(n => <option key={n} value={n} />)}</datalist>
        {editor.relations.map((relation, i) => <div className="relation-row" key={i}>
          <input list="character-names" value={relation.target} onChange={e => setRelation(i, { target: e.target.value })} placeholder="对象角色" />
          <input value={relation.relation} onChange={e => setRelation(i, { relation: e.target.value })} placeholder="关系，如 师徒／父女／旧情" />
          <input value={relation.note} onChange={e => setRelation(i, { note: e.target.value })} placeholder="说明（可选）" />
          <button className="icon-button danger" title="删除关系" onClick={() => onChange({ ...editor, relations: editor.relations.filter((_, n) => n !== i) })}>×</button>
        </div>)}
        {!editor.relations.length && <p className="muted">尚未添加人际关系。</p>}
      </div>

      <div className="action-row dialog-actions">
        <button className="button" disabled={busy === 'fill'} onClick={onAiFill}><Sparkles size={15} />{busy === 'fill' ? '补全中…' : 'AI 补全档案'}</button>
        <button className="button" onClick={onCancel}>取消</button>
        <button className="button primary" onClick={onSave}>保存角色</button>
      </div>
    </div>
  </div>;
}

function MergeGroups({ groups, onMerge, onClose }: { groups: string[]; onMerge(from: string, into: string): void; onClose(): void }) {
  const [from, setFrom] = useState(groups[0] ?? '');
  const [into, setInto] = useState(groups[1] ?? groups[0] ?? '');
  return <div className="merge-controls">
    <label>合并来源<select value={from} onChange={e => setFrom(e.target.value)}>{groups.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
    <label>并入<select value={into} onChange={e => setInto(e.target.value)}>{groups.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
    <div className="action-row">
      <button className="button primary" disabled={!from || !into || from === into} onClick={() => onMerge(from, into)}>合并</button>
      <button className="button" onClick={onClose}>取消</button>
    </div>
  </div>;
}
