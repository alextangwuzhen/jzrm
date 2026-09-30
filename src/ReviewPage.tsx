import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Download, Eye, FileText, RefreshCcw, ShieldCheck, Sparkles, Trash2, WandSparkles, X } from 'lucide-react';
import { useApp } from './context';
import { listEntities, type Entity } from './store';
import { platform } from './platform';
import { availableModels, extractJson, modelFromProvider, workContext } from './ai';
import { createRewriteProposal, reviewDimensions, reviewEligibility } from './review';
import { splitImportedChapters } from './importedChapters';
import { restrictionTypes } from './restrictions';

type Issue = { quote: string; dimension: string; reason: string; suggestion: string };
type ReviewResult = { scores?: Record<string, number>; overall?: number; issues?: Issue[]; plan?: string[] };
type ChapterReview = { overall?: number; scores?: Record<string, number>; summary?: string; aiTrace?: string[]; issues?: Issue[] };
type EmotionPhase = { from: string; to: string; intensity: string };
type EmotionTarget = { role: string; phases: EmotionPhase[] };

const polishModes = ['AI 续写', '去人机味', '上下文逻辑自动对齐', '情绪强化', '心理描写强化', '环境描写强化', '动作描写强化', '反转／爽点设计植入', '节奏与伏笔优化', '对话增强', '文风强化'];
const polishDirections: Record<string, string> = {
  'AI 续写': '只输出自然衔接在原文后面的新段落，不重复原文；遵守人物知情边界。',
  '去人机味': '删除空泛评价、模板化过渡、重复总结和机械排比，用具体动作与有差异的声线代替。',
  '上下文逻辑自动对齐': '逐一核对设定、前后事件和人物知情范围，修正冲突，不添加未经支持的事实。',
  '情绪强化': '用人物的选择、动作和对话推进情绪，避免直接贴情绪标签。',
  '心理描写强化': '补足与当下行为有关的心理动机与摇摆，保留克制和人物声线。',
  '环境描写强化': '补足能影响行动或情绪的环境细节，不堆砌无关感官词。',
  '动作描写强化': '让动作具有空间关系、结果和代价，避免无意义的连续动作。',
  '反转／爽点设计植入': '在已有信息里埋设铺垫，再给出合理反转与行动回报，不能凭空制造能力或线索。',
  '节奏与伏笔优化': '调整信息披露与场景长度，保留伏笔的埋设、误导和回收线索。',
  '对话增强': '让每个人物有不同目的和声线；对话必须改变关系或推进事件。',
  '文风强化': '遵守所选文风和 Skill，但不照抄参考作品句子。'
};
const zhuqueDimensions = ['句式模板化', '词汇重复', '过度解释', '情绪标签', '排比堆砌', '逻辑跳跃', '语气单一'];
const readerPerspectives = ['小白读者', '老书虫', '编辑视角'];
const emotionSuggestions = ['快乐', '悲伤', '愤怒', '恐惧', '释怀', '笑', '哭', '快乐的小二逼', '克制的悲伤'];
const intensitySuggestions = ['大', '中', '小'];

export function ReviewPage({ polish = false }: { polish?: boolean }) {
  if (polish) return <PolishPage />;
  return <ReviewWorkspace />;
}

/* ------------------------------------------------------------------ */
/* AI 润笔（单项任务台）                                                  */
/* ------------------------------------------------------------------ */

function normalizeEmotionTargets(value: unknown): EmotionTarget[] {
  if (!Array.isArray(value)) return [{ role: '', phases: [{ from: '', to: '', intensity: '' }, { from: '', to: '', intensity: '' }] }];
  return (value as Array<Record<string, unknown>>).map(row => ({
    role: String(row.role ?? ''),
    phases: Array.isArray(row.phases) ? (row.phases as Array<Record<string, unknown>>).map(p => ({
      from: String(p.from ?? p.trait ?? ''),
      to: String(p.to ?? p.chapter ?? ''),
      intensity: String(p.intensity ?? '')
    })) : []
  }));
}

function PolishPage() {
  const app = useApp();
  const works = listEntities(app.state, { kind: 'work' });
  const draftEntity = listEntities(app.state, { kind: 'attachment' }).find(e => e.category === '润笔草稿');
  const initialDraft = useRef<Record<string, unknown>>((() => { try { return JSON.parse(draftEntity?.content ?? '{}') as Record<string, unknown>; } catch { return {}; } })());
  const draftId = useRef(draftEntity?.id ?? '');
  const [sourceId, setSourceId] = useState(String(initialDraft.current.sourceId ?? (app.workId ? `work:${app.workId}` : works[0] ? `work:${works[0].id}` : '')));
  const workId = sourceId.startsWith('work:') ? sourceId.slice(5) : '';
  const attachments = listEntities(app.state, { kind: 'attachment' }).filter(a => a.category === '润笔素材');
  const attachment = sourceId.startsWith('file:') ? attachments.find(a => a.id === sourceId.slice(5)) : undefined;
  const chapters = listEntities(app.state, { kind: 'chapter', workId: workId || '__none__' });
  const importedSections = useMemo(() => attachment ? splitImportedChapters(attachment.content) : [], [attachment?.id, attachment?.content]);
  const [chapterId, setChapterId] = useState(String(initialDraft.current.chapterId ?? chapters[0]?.id ?? ''));
  const chapter = chapters.find(c => c.id === chapterId);
  const importedSection = importedSections.find(c => c.id === chapterId);
  const [text, setText] = useState(String(initialDraft.current.text ?? chapter?.content ?? ''));
  const [selectedText, setSelectedText] = useState('');
  const [modelId, setModelId] = useState(String(initialDraft.current.modelId ?? ''));
  const [busy, setBusy] = useState(false);
  const [variants, setVariants] = useState<string[]>(Array.isArray(initialDraft.current.variants) ? initialDraft.current.variants as string[] : []);
  const [mode, setMode] = useState(String(initialDraft.current.mode ?? polishModes[0]));
  const [skillId, setSkillId] = useState(String(initialDraft.current.skillId ?? ''));
  const [styleId, setStyleId] = useState<string | null>(initialDraft.current.styleId == null ? null : String(initialDraft.current.styleId));
  const [restrictionIds, setRestrictionIds] = useState<string[]>(Array.isArray(initialDraft.current.restrictionIds) ? initialDraft.current.restrictionIds as string[] : []);
  const [emotionTargets, setEmotionTargets] = useState<EmotionTarget[]>(() => normalizeEmotionTargets(initialDraft.current.emotionTargets));
  const providers = availableModels(app.state.entities);
  const skills = listEntities(app.state, { kind: 'skill' });
  const styles = listEntities(app.state, { kind: 'style' });
  const restrictions = listEntities(app.state, { kind: 'memory', category: 'restriction' });
  const histories = listEntities(app.state, { kind: 'attachment' }).filter(e => e.category === '润笔记录').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const characterNames = listEntities(app.state, { kind: 'setting', workId: workId || app.workId, category: 'characters' }).filter(e => !e.meta.imageData && !['人物档案', '人物关系'].includes(e.title)).map(e => e.title);
  const roleBooks = listEntities(app.state, { kind: 'roleBook' });
  const roleBook = sourceId.startsWith('role:') ? roleBooks.find(r => r.id === sourceId.slice(5)) : undefined;
  const activeStyle = styles.find(s => s.id === (styleId === null ? works.find(w => w.id === workId)?.meta.styleId : styleId));
  const activeSkill = skills.find(s => s.id === skillId);
  const selectedProvider = providers.find(p => p.id === modelId) ?? providers[0];
  const context = workContext(app.state.entities, workId || roleBook?.workId || attachment?.workId || app.workId, app.state.preferences.contextLimit);

  const historySave = (action: string, response: string) => app.add('attachment', `${new Date().toLocaleString('zh-CN')} · ${action}`, JSON.stringify({ sourceId, chapterId, text, mode, emotionTargets, restrictionIds, modelId, skillId, styleId, action, response }), { workId: workId || roleBook?.workId || app.workId, category: '润笔记录' });
  const restoreHistory = (content: string) => { try { const h = JSON.parse(content); setSourceId(h.sourceId ?? ''); setChapterId(h.chapterId ?? ''); setText(h.text ?? ''); setMode(h.mode ?? polishModes[0]); setEmotionTargets(normalizeEmotionTargets(h.emotionTargets)); setRestrictionIds(h.restrictionIds ?? []); setModelId(h.modelId ?? ''); setSkillId(h.skillId ?? ''); setStyleId(h.styleId ?? null); setSelectedText(h.text ?? ''); setVariants(h.response ? [h.response] : []); } catch { app.notify('历史记录无法读取'); } };

  useEffect(() => { const timer = window.setTimeout(() => { const content = JSON.stringify({ sourceId, chapterId, text, mode, emotionTargets, restrictionIds, modelId, skillId, styleId, variants }); if (draftId.current) app.update(draftId.current, { content }); else { const item = app.add('attachment', '润笔草稿', content, { category: '润笔草稿' }); draftId.current = item.id; } }, 80); return () => window.clearTimeout(timer); }, [sourceId, chapterId, text, mode, emotionTargets, restrictionIds, modelId, skillId, styleId, variants]);
  const mounted = useRef(false);
  useEffect(() => { if (!mounted.current) { mounted.current = true; return; } if (sourceId === '') return; setText(chapter?.content ?? importedSection?.content ?? roleBook?.content ?? ''); setSelectedText(''); setVariants([]); }, [sourceId, chapterId, chapter?.content, importedSection?.content, roleBook?.content]);

  const selectSource = (value: string) => { setSourceId(value); if (value.startsWith('work:')) { const first = listEntities(app.state, { kind: 'chapter', workId: value.slice(5) })[0]; setChapterId(first?.id ?? ''); setText(first?.content ?? ''); } else if (value.startsWith('file:')) { const file = attachments.find(a => a.id === value.slice(5)); const first = file ? splitImportedChapters(file.content)[0] : undefined; setChapterId(first?.id ?? ''); setText(first?.content ?? ''); } else if (value.startsWith('role:')) { setChapterId(''); setText(roleBooks.find(r => r.id === value.slice(5))?.content ?? ''); } else { setChapterId(''); setText(''); } setVariants([]); };
  const importSource = async () => { try { const file = await platform().importText(); if (file) { const item = app.add('attachment', file.name, file.text, { workId: app.workId, category: '润笔素材' }); setSourceId(`file:${item.id}`); const first = splitImportedChapters(file.text)[0]; setChapterId(first?.id ?? ''); setText(first?.content ?? ''); setVariants([]); app.notify(`已导入：${file.name}`); } } catch (e) { app.notify(String(e)); } };
  const run = async (prompt: string) => { const model = modelFromProvider(selectedProvider); if (!model) { app.notify('请先在 AI 配置中添加模型和密钥'); return ''; } setBusy(true); try { return await platform().runAi({ ...model, prompt }); } catch (e) { app.notify(String(e)); return ''; } finally { setBusy(false); } };
  const applyVariant = (variant: string) => {
    if (!selectedText || !text.includes(selectedText)) { app.notify('原文已改变，请重新选择文本'); return; }
    const next = text.replace(selectedText, variant);
    if (chapter) { app.add('snapshot', `${chapter.title} · 修改前`, chapter.content, { workId, parentId: chapter.id }); app.update(chapter.id, { content: next }); }
    else if (roleBook) { app.add('snapshot', `${roleBook.title} · 修改前`, roleBook.content, { workId: roleBook.workId, parentId: roleBook.id }); app.update(roleBook.id, { content: next }); }
    else if (attachment) { app.add('snapshot', `${attachment.title} · 修改前`, attachment.content, { workId: attachment.workId, parentId: attachment.id }); app.update(attachment.id, { content: next }); }
    setText(next); setVariants([]); app.notify('已替换，并保存修改前版本');
  };
  const emotionPhrase = emotionTargets.map(row => `${row.role || '未指定角色'}：${row.phases.map(p => `${p.from || '未指定'}→${p.to || '未指定'}（${p.intensity || '中'}）`).join('；')}`).join('。');
  const polishRun = async () => {
    if (!text.trim()) { app.notify('请输入或选择作品文本'); return; }
    const response = await run(`请对文本执行「${mode}」单项强化。具体要求：${polishDirections[mode]}\n只输出结果正文，不解释。保持作品事实一致，遵守以下设定与限制：\n${context}\n所选文风包（抽象技法，不照抄示例）：\n${activeStyle ? `${activeStyle.title}\n${activeStyle.content}` : '未选择'}\n所选 Skill：\n${activeSkill?.content ?? '未选择'}\n角色情绪变化目标（起始情绪→目标情绪→强度）：${emotionPhrase || '未指定'}\n所选限制：${restrictions.filter(r => restrictionIds.includes(r.id)).map(r => `${r.meta.restrictionType} ${r.title}：${r.content}`).join('；') || '未选择'}\n原文：\n${text}`);
    if (response) { const proposal = mode === 'AI 续写' ? `${text.trimEnd()}\n\n${response.trim()}` : response; setSelectedText(text); setVariants([proposal]); historySave(mode, proposal); }
  };
  const exportResult = async (format: 'txt' | 'docx' | 'pdf') => { try { await platform().exportFile({ title: `${chapter?.title ?? importedSection?.title ?? '文本'}-润笔`, content: `${text}\n\n润笔结果\n${variants[0] ?? ''}`, format }); } catch (e) { app.notify(String(e)); } };

  return <><div className="page-intro"><div><span className="eyebrow">AI POLISH / SINGLE TASK</span><h2>AI 润笔</h2><p>单项强化，并在应用前检查差异。</p></div><div className="action-row">{(['txt', 'docx', 'pdf'] as const).map(format => <button key={format} className="button" onClick={() => exportResult(format)}><Download size={15} />{format.toUpperCase()}</button>)}</div></div><div className="review-layout">
    <section className="paper-page">
      <div className="panel-heading"><h3>选择文本</h3><div className="action-row"><span>{text.replace(/\s/g, '').length} 字</span><button className="button" onClick={importSource}><FileText size={15} />导入作品文件</button></div></div>
      {attachment && <p className="muted">当前导入：{attachment.title} · 不会覆盖原作品章节</p>}
      <div className="form-grid">
        <label>作品或导入文件<select value={sourceId} onChange={e => selectSource(e.target.value)}><option value="">自定义粘贴文本</option><optgroup label="作品库">{works.map(w => <option key={w.id} value={`work:${w.id}`}>{w.title}</option>)}</optgroup><optgroup label="导入文件">{attachments.map(a => <option key={a.id} value={`file:${a.id}`}>{a.title}</option>)}</optgroup><optgroup label="剧本杀角色本">{roleBooks.map(r => <option key={r.id} value={`role:${r.id}`}>{r.title}</option>)}</optgroup></select></label>
        <label>章节<select value={chapterId} disabled={!sourceId} onChange={e => setChapterId(e.target.value)}><option value="">{sourceId ? '选择章节' : '自定义文本'}</option>{sourceId.startsWith('work:') ? chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>) : importedSections.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      </div>
      {attachment && <button className="button danger" onClick={() => { app.trash(attachment.id); selectSource(''); }}><Trash2 size={14} />删除当前导入文件</button>}
      <textarea className="source-textarea" value={text} onChange={e => setText(e.target.value)} onSelect={e => { const t = e.currentTarget; setSelectedText(t.value.slice(t.selectionStart, t.selectionEnd)); }} placeholder="选择作品章节，或粘贴需要润笔的文本……" />

      <section className="polish-settings">
        <h4>情绪目标 · 角色情绪变化</h4>
        <p className="muted">第一栏选择角色，随后按「起始情绪 → 目标情绪 → 强度」逐列填写，可增删行与列。</p>
        <datalist id="polish-characters">{characterNames.map(name => <option key={name} value={name} />)}</datalist>
        <datalist id="polish-emotions">{emotionSuggestions.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="polish-intensity">{intensitySuggestions.map(x => <option key={x} value={x} />)}</datalist>
        <div className="polish-emotion-rows">
          {emotionTargets.map((row, rowIndex) => <div className="polish-emotion-row" key={rowIndex}>
            <select aria-label="目标角色" value={row.role} onChange={e => setEmotionTargets(rows => rows.map((v, i) => i === rowIndex ? { ...v, role: e.target.value } : v))}><option value="">选择角色</option>{characterNames.map(name => <option key={name} value={name}>{name}</option>)}</select>
            <div className="emotion-flow">
              {row.phases.map((phase, i) => <div className="emotion-phase" key={i}>
                {i > 0 && <span className="emotion-arrow">→</span>}
                <div className="emotion-phase-fields">
                  <input list="polish-emotions" aria-label={`第${i + 1}列起始情绪`} value={phase.from} onChange={e => setEmotionTargets(rows => rows.map((v, n) => n === rowIndex ? { ...v, phases: v.phases.map((p, j) => j === i ? { ...p, from: e.target.value } : p) } : v))} placeholder="悲伤" />
                  <input list="polish-emotions" aria-label={`第${i + 1}列目标情绪`} value={phase.to} onChange={e => setEmotionTargets(rows => rows.map((v, n) => n === rowIndex ? { ...v, phases: v.phases.map((p, j) => j === i ? { ...p, to: e.target.value } : p) } : v))} placeholder="开心" />
                  <input list="polish-intensity" aria-label={`第${i + 1}列强度`} value={phase.intensity} onChange={e => setEmotionTargets(rows => rows.map((v, n) => n === rowIndex ? { ...v, phases: v.phases.map((p, j) => j === i ? { ...p, intensity: e.target.value } : p) } : v))} placeholder="大小" />
                </div>
                <button className="icon-button danger" title="删除列" onClick={() => setEmotionTargets(rows => rows.map((v, n) => n === rowIndex ? { ...v, phases: v.phases.filter((_, j) => j !== i) } : v))}>×</button>
              </div>)}
              <button className="button emotion-add-phase" onClick={() => setEmotionTargets(rows => rows.map((v, n) => n === rowIndex ? { ...v, phases: [...v.phases, { from: '', to: '', intensity: '' }] } : v))}>+ 列</button>
            </div>
            <button className="icon-button danger" title="删除角色行" onClick={() => setEmotionTargets(rows => rows.filter((_, n) => n !== rowIndex))}><Trash2 size={15} /></button>
          </div>)}
        </div>
        <button className="button" onClick={() => setEmotionTargets(rows => [...rows, { role: '', phases: [{ from: '', to: '', intensity: '' }, { from: '', to: '', intensity: '' }] }])}>+ 行</button>
      </section>

      <section className="polish-settings">
        <h4>文风与限制</h4>
        <label>文风包<select value={styleId === null ? String(works.find(w => w.id === workId)?.meta.styleId ?? '') : styleId} onChange={e => setStyleId(e.target.value)}><option value="">不使用文风包</option>{styles.map(style => <option key={style.id} value={style.id}>{style.title}</option>)}</select></label>
        {restrictionTypes.map(type => <label key={type}>{type}<select value="" onChange={e => { if (e.target.value && !restrictionIds.includes(e.target.value)) setRestrictionIds(ids => [...ids, e.target.value]); }}><option value="">添加{type}</option>{restrictions.filter(r => r.meta.restrictionType === type && !restrictionIds.includes(r.id)).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>)}
        <div className="restriction-chips">{restrictions.filter(r => restrictionIds.includes(r.id)).map(r => <button key={r.id} className="button" onClick={() => setRestrictionIds(ids => ids.filter(id => id !== r.id))}>{r.title} ×</button>)}</div>
      </section>

      <label>使用模型<select value={modelId} onChange={e => setModelId(e.target.value)}><option value="">{providers[0]?.title ?? '请先配置模型'}</option>{providers.map(p => <option key={p.id} value={p.id}>{p.title} · {String(p.meta.model ?? '')}</option>)}</select></label>
      <label>强化任务<select value={mode} onChange={e => setMode(e.target.value)}>{polishModes.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>应用 Skill<select value={skillId} onChange={e => setSkillId(e.target.value)}><option value="">不使用 Skill</option>{skills.map(skill => <option key={skill.id} value={skill.id}>{skill.title}</option>)}</select></label>
      <button className="button" onClick={async () => { try { const file = await platform().importText(); if (file) { const skill = app.add('skill', file.name, file.text); setSkillId(skill.id); } } catch (e) { app.notify(String(e)); } }}><FileText size={15} />导入 Skill</button>
      <button className="button primary" disabled={busy} onClick={polishRun}><WandSparkles size={16} />{busy ? '处理中…' : '生成润笔提案'}</button>
    </section>

    <section className="paper-page">
      <div className="panel-heading"><h3>润笔提案</h3></div>
      {variants.length > 0 && <div className="variant-list"><h4>修改预览</h4>{variants.map((variant, i) => <div key={i} className="variant-card"><span>方案 {i + 1}</span><p>{variant}</p><button className="button primary" onClick={() => applyVariant(variant)}><Check size={15} />替换原文</button></div>)}</div>}
      {!variants.length && <div className="empty-small">选择润笔任务。AI 结果先在这里预览，再决定是否应用。</div>}
    </section>
  </div>
  <section className="paper-page history-panel"><div className="panel-heading"><h3>润笔历史</h3><small>{histories.length} 条 · 点击恢复输入与结果</small></div><div className="history-list">{histories.map(h => <div className="history-row" key={h.id}><button className="button" onClick={() => restoreHistory(h.content)}>{h.title}</button><button className="icon-button danger" title="移入垃圾箱" onClick={() => app.trash(h.id)}><Trash2 size={14} /></button></div>)}{!histories.length && <div className="empty-small">完成一次处理后自动保存记录。</div>}</div></section></>;
}

/* ------------------------------------------------------------------ */
/* 审查修改（审查 / 修改 / 读者模拟 / 朱雀AI检测）                          */
/* ------------------------------------------------------------------ */

function ReviewWorkspace() {
  const app = useApp();
  const works = listEntities(app.state, { kind: 'work' });
  const draftEntity = listEntities(app.state, { kind: 'attachment' }).find(e => e.category === '审校草稿');
  const initialDraft = useRef<Record<string, unknown>>((() => { try { return JSON.parse(draftEntity?.content ?? '{}') as Record<string, unknown>; } catch { return {}; } })());
  const draftId = useRef(draftEntity?.id ?? '');
  const [tab, setTab] = useState<'review' | 'edit' | 'reader' | 'zhuque'>(String(initialDraft.current.tab ?? 'review') as 'review' | 'edit' | 'reader' | 'zhuque');
  const [sourceId, setSourceId] = useState(String(initialDraft.current.sourceId ?? (app.workId ? `work:${app.workId}` : works[0] ? `work:${works[0].id}` : '')));
  const workId = sourceId.startsWith('work:') ? sourceId.slice(5) : '';
  const attachments = listEntities(app.state, { kind: 'attachment' }).filter(a => a.category === '审校素材');
  const attachment = sourceId.startsWith('file:') ? attachments.find(a => a.id === sourceId.slice(5)) : undefined;
  const chapters = listEntities(app.state, { kind: 'chapter', workId: workId || '__none__' });
  const importedSections = useMemo(() => attachment ? splitImportedChapters(attachment.content) : [], [attachment?.id, attachment?.content]);
  const [chapterId, setChapterId] = useState(String(initialDraft.current.chapterId ?? chapters[0]?.id ?? ''));
  const chapter = chapters.find(c => c.id === chapterId);
  const importedSection = importedSections.find(c => c.id === chapterId);
  const [text, setText] = useState(String(initialDraft.current.text ?? chapter?.content ?? ''));
  const [selectedText, setSelectedText] = useState('');
  const [modelId, setModelId] = useState(String(initialDraft.current.modelId ?? ''));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>((initialDraft.current.result as ReviewResult | null) ?? null);
  const [raw, setRaw] = useState(String(initialDraft.current.raw ?? ''));
  const [variants, setVariants] = useState<string[]>(Array.isArray(initialDraft.current.variants) ? initialDraft.current.variants as string[] : []);
  const [focus, setFocus] = useState(String(initialDraft.current.focus ?? ''));
  const [comparator, setComparator] = useState(String(initialDraft.current.comparator ?? ''));
  const [rewriteDialog, setRewriteDialog] = useState<{ original: string; variants: string[] } | null>(null);
  const providers = availableModels(app.state.entities);
  const selectedProvider = providers.find(p => p.id === modelId) ?? providers[0];
  const context = workContext(app.state.entities, workId || attachment?.workId || app.workId, app.state.preferences.contextLimit);
  const histories = listEntities(app.state, { kind: 'attachment' }).filter(e => e.category === '审校记录').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const eligible = reviewEligibility(text);

  const historySave = (action: string, response: string) => app.add('attachment', `${new Date().toLocaleString('zh-CN')} · ${action}`, JSON.stringify({ sourceId, chapterId, text, focus, modelId, comparator, action, response }), { workId: workId || attachment?.workId || app.workId, category: '审校记录' });
  const restoreHistory = (content: string) => { try { const h = JSON.parse(content); setSourceId(h.sourceId ?? ''); setChapterId(h.chapterId ?? ''); setText(h.text ?? ''); setFocus(h.focus ?? ''); setModelId(h.modelId ?? ''); setComparator(h.comparator ?? ''); setRaw(h.response ?? ''); setVariants([]); if (h.action === '三案改写' || h.action === '整篇修改') { const parsed = extractJson(h.response); setSelectedText(h.text ?? ''); setVariants(Array.isArray(parsed) ? parsed : [h.response]); setResult(null); } else { setResult(extractJson(h.response) as ReviewResult); } } catch { app.notify('历史记录无法读取'); } };

  useEffect(() => { const timer = window.setTimeout(() => { const content = JSON.stringify({ tab, sourceId, chapterId, text, focus, modelId, comparator, result, raw, variants, selectedText }); if (draftId.current) app.update(draftId.current, { content }); else { const item = app.add('attachment', '审校草稿', content, { category: '审校草稿' }); draftId.current = item.id; } }, 80); return () => window.clearTimeout(timer); }, [tab, sourceId, chapterId, text, focus, modelId, comparator, result, raw, variants, selectedText]);
  const mounted = useRef(false);
  useEffect(() => { if (!mounted.current) { mounted.current = true; return; } if (sourceId === '') return; setText(chapter?.content ?? importedSection?.content ?? ''); setSelectedText(''); setResult(null); setRaw(''); setVariants([]); }, [sourceId, chapterId, chapter?.content, importedSection?.content]);

  const selectSource = (value: string) => { setSourceId(value); if (value.startsWith('work:')) { const first = listEntities(app.state, { kind: 'chapter', workId: value.slice(5) })[0]; setChapterId(first?.id ?? ''); setText(first?.content ?? ''); } else if (value.startsWith('file:')) { const file = attachments.find(a => a.id === value.slice(5)); const first = file ? splitImportedChapters(file.content)[0] : undefined; setChapterId(first?.id ?? ''); setText(first?.content ?? ''); } else { setChapterId(''); setText(''); } setResult(null); setRaw(''); setVariants([]); };
  const importSource = async () => { try { const file = await platform().importText(); if (file) { const item = app.add('attachment', file.name, file.text, { workId: app.workId, category: '审校素材' }); setSourceId(`file:${item.id}`); const first = splitImportedChapters(file.text)[0]; setChapterId(first?.id ?? ''); setText(first?.content ?? ''); setResult(null); setRaw(''); app.notify(`已导入：${file.name}`); } } catch (e) { app.notify(String(e)); } };
  const run = async (prompt: string) => { const model = modelFromProvider(selectedProvider); if (!model) { app.notify('请先在 AI 配置中添加模型和密钥'); return ''; } setBusy(true); try { return await platform().runAi({ ...model, prompt }); } catch (e) { app.notify(String(e)); return ''; } finally { setBusy(false); } };

  const applyVariant = (variant: string) => {
    const original = rewriteDialog?.original ?? selectedText;
    if (!original || !text.includes(original)) { app.notify('原文已改变，请重新选择文本'); setRewriteDialog(null); return; }
    const next = text.replace(original, variant);
    if (chapter) { app.add('snapshot', `${chapter.title} · 修改前`, chapter.content, { workId, parentId: chapter.id }); app.update(chapter.id, { content: next }); }
    else if (attachment) { app.add('snapshot', `${attachment.title} · 修改前`, attachment.content, { workId: attachment.workId, parentId: attachment.id }); app.update(attachment.id, { content: next }); }
    setText(next); setSelectedText(''); setVariants([]); setRewriteDialog(null); app.notify('已替换，并保存修改前版本');
  };
  const exportResult = async (format: 'txt' | 'docx' | 'pdf') => { try { await platform().exportFile({ title: `${chapter?.title ?? importedSection?.title ?? '文本'}-审校`, content: `${text}\n\n审校报告\n${raw}`, format }); } catch (e) { app.notify(String(e)); } };

  return <><div className="page-intro"><div><span className="eyebrow">REVIEW / EVIDENCE</span><h2>审查修改</h2><p>章节评审、修改与替换、读者模拟与朱雀 AI 检测。</p></div><div className="action-row">{(['txt', 'docx', 'pdf'] as const).map(format => <button key={format} className="button" onClick={() => exportResult(format)}><Download size={15} />{format.toUpperCase()}</button>)}</div></div>
    <div className="review-tabs">
      {([['review', '审查', Sparkles], ['edit', '修改', WandSparkles], ['reader', '读者模拟', Eye], ['zhuque', '朱雀AI检测', ShieldCheck]] as const).map(([key, label, Icon]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}><Icon size={16} />{label}</button>)}
    </div>
    <div className="review-layout">
      <section className="paper-page">
        <div className="panel-heading"><h3>选择文本</h3><div className="action-row"><span>{text.replace(/\s/g, '').length} 字</span><button className="button" onClick={importSource}><FileText size={15} />导入作品文件</button></div></div>
        {attachment && <p className="muted">当前导入：{attachment.title} · 不会覆盖原作品章节</p>}
        <div className="form-grid">
          <label>作品或导入文件<select value={sourceId} onChange={e => selectSource(e.target.value)}><option value="">自定义粘贴文本</option><optgroup label="作品库">{works.map(w => <option key={w.id} value={`work:${w.id}`}>{w.title}</option>)}</optgroup><optgroup label="导入文件">{attachments.map(a => <option key={a.id} value={`file:${a.id}`}>{a.title}</option>)}</optgroup></select></label>
          <label>章节<select value={chapterId} disabled={!sourceId} onChange={e => setChapterId(e.target.value)}><option value="">{sourceId ? '选择章节' : '自定义文本'}</option>{sourceId.startsWith('work:') ? chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>) : importedSections.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        </div>
        {attachment && <button className="button danger" onClick={() => { app.trash(attachment.id); selectSource(''); }}><Trash2 size={14} />删除当前导入文件</button>}
        <textarea className="source-textarea" value={text} onChange={e => setText(e.target.value)} onSelect={e => { const t = e.currentTarget; setSelectedText(t.value.slice(t.selectionStart, t.selectionEnd)); }} placeholder="选择作品章节，或粘贴需要审校的文本……" />
        <label>使用模型<select value={modelId} onChange={e => setModelId(e.target.value)}><option value="">{providers[0]?.title ?? '请先配置模型'}</option>{providers.map(p => <option key={p.id} value={p.id}>{p.title} · {String(p.meta.model ?? '')}</option>)}</select></label>
      </section>

      {tab === 'review' && <ChapterReviewTab workId={workId} chapters={chapters} run={run} selectedProvider={selectedProvider} context={context} busy={busy} onEditText={(t, chId) => { if (chId) setChapterId(chId); setText(t); setTab('edit'); }} />}
      {tab === 'edit' && <EditTab text={text} selectedText={selectedText} focus={focus} comparator={comparator} context={context} eligible={eligible} result={result} raw={raw} variants={variants} busy={busy} onFocus={setFocus} onComparator={setComparator} onResult={setResult} onRaw={setRaw} onVariants={setVariants} onSelectedText={setSelectedText} run={run} applyVariant={applyVariant} setRewriteDialog={setRewriteDialog} historySave={historySave} />}
      {tab === 'reader' && <ReaderSimTab workId={workId} chapters={chapters} run={run} busy={busy} />}
      {tab === 'zhuque' && <ZhuqueTab chapter={chapter} importedSection={importedSection} text={text} context={context} run={run} busy={busy} />}
    </div>
    <section className="paper-page history-panel"><div className="panel-heading"><h3>审校历史</h3><small>{histories.length} 条 · 点击恢复输入与结果</small></div><div className="history-list">{histories.map(h => <div className="history-row" key={h.id}><button className="button" onClick={() => restoreHistory(h.content)}>{h.title}</button><button className="icon-button danger" title="移入垃圾箱" onClick={() => app.trash(h.id)}><Trash2 size={14} /></button></div>)}{!histories.length && <div className="empty-small">完成一次处理后自动保存记录。</div>}</div></section>
    {rewriteDialog && <RewriteDialog original={rewriteDialog.original} variants={rewriteDialog.variants} onApply={applyVariant} onClose={() => setRewriteDialog(null)} />}
  </>;
}

/* 审查页：逐章评审表（StarWriter 章节评审） */
function ChapterReviewTab({ workId, chapters, run, selectedProvider, context, busy, onEditText }: {
  workId: string; chapters: Entity[]; run(prompt: string): Promise<string>; selectedProvider?: Entity; context: string; busy: boolean; onEditText(text: string, chapterId?: string): void;
}) {
  const app = useApp();
  const reviews = listEntities(app.state, { kind: 'review', workId }).filter(r => r.parentId);
  const [detailId, setDetailId] = useState<string | null>(null);
  const byChapter = new Map(reviews.map(r => [String(r.parentId), r]));
  const detail = reviews.find(r => r.id === detailId);

  const reviewChapter = async (chapter: Entity) => {
    const prompt = `你是小说审校员。评审以下章节，给出：综合分（0-100）、${reviewDimensions.join('、')}七维分、一句话摘要、AI 痕迹（只列出重复结构、套话、过度解释等可编辑现象，不判定作者身份）、原文证据与建议。材料不足时降低综合分并说明缺口，不输出看似精确的分数。\n作品事实与限制：\n${context}\n章节：\n${chapter.content}\n只返回 JSON: {"overall":0,"scores":{"${reviewDimensions.join('":0,"')}":0},"summary":"","aiTrace":[],"issues":[{"quote":"原文证据","dimension":"维度","reason":"问题","suggestion":"建议"}]}`;
    const response = await run(prompt);
    if (!response) return;
    app.add('review', `${chapter.title} · 审查`, response, { workId: workId || undefined, parentId: chapter.id, meta: { model: selectedProvider?.title, createdAt: new Date().toISOString() } });
    app.notify(`已评审《${chapter.title}》`);
  };

  const parseReview = (r: Entity): ChapterReview => { try { return extractJson(r.content) as ChapterReview; } catch { return {}; } };
  const parsed = detail ? parseReview(detail) : null;

  return <section className="paper-page">
    <div className="panel-heading"><h3>章节评审</h3><span>{reviews.length} 章已评审</span></div>
    <p className="muted">逐章 AI 评审，列综合评分、AI 痕迹与摘要；点击章节查看证据与建议。</p>
    {!chapters.length && <div className="empty-small">当前作品还没有章节，先在正文页建立章节。</div>}
    <table className="chapter-review-table">
      <thead><tr><th>章节</th><th>字数</th><th>综合评分</th><th>摘要</th><th>AI 痕迹</th><th></th></tr></thead>
      <tbody>{chapters.map(c => { const review = byChapter.get(c.id); const data = review ? parseReview(review) : {}; return <tr key={c.id} className={review ? 'reviewed' : ''}>
        <td>{c.title}</td>
        <td>{c.content.replace(/\s/g, '').length}</td>
        <td className="review-score">{data.overall != null ? `${data.overall} / 100` : '—'}</td>
        <td>{data.summary ?? ''}</td>
        <td>{(data.aiTrace ?? []).slice(0, 3).map((t, i) => <span key={i} className="ai-trace">{t}</span>)}</td>
        <td><button className="button" disabled={busy} onClick={() => reviewChapter(c)}><Sparkles size={14} />评审</button></td>
      </tr>; })}</tbody>
    </table>
    {reviews.map(r => <button key={r.id} className="button" style={{ marginTop: 12, marginRight: 8 }} onClick={() => setDetailId(r.id)}>{r.title}</button>)}

    {parsed && detail && <div className="report-preview">
      <div className="panel-heading"><h3>{detail.title} · 评审详情</h3><button className="button" onClick={() => onEditText(chapters.find(c => c.id === detail.parentId)?.content ?? '', detail.parentId)}>进入修改页</button></div>
      {parsed.overall != null && <strong className="score">{parsed.overall} / 100</strong>}
      {parsed.scores && <div className="score-grid">{reviewDimensions.map(d => <div key={d}><span>{d}</span><strong>{parsed.scores?.[d] ?? '—'}</strong><small>参考 90</small></div>)}</div>}
      {parsed.summary && <p><strong>摘要：</strong>{parsed.summary}</p>}
      {parsed.aiTrace && <p><strong>AI 痕迹：</strong>{parsed.aiTrace.map((t, i) => <span key={i} className="ai-trace">{t}</span>)}</p>}
      {parsed.issues?.map((issue, i) => <div className="issue-card" key={i}><span className="tiny-label">{issue.dimension}</span><blockquote>{issue.quote}</blockquote><p>{issue.reason}</p><small>{issue.suggestion}</small></div>)}
    </div>}
  </section>;
}

/* 修改页：整篇修改 + 局部问题定位修改 + 三案改写弹窗 */
function EditTab({ text, selectedText, focus, comparator, context, eligible, result, raw, variants, busy, onFocus, onComparator, onResult, onRaw, onVariants, onSelectedText, run, applyVariant, setRewriteDialog, historySave }: {
  text: string; selectedText: string; focus: string; comparator: string; context: string; eligible: ReturnType<typeof reviewEligibility>; result: ReviewResult | null; raw: string; variants: string[]; busy: boolean;
  onFocus(v: string): void; onComparator(v: string): void; onResult(r: ReviewResult | null): void; onRaw(v: string): void; onVariants(v: string[]): void; onSelectedText(v: string): void;
  run(prompt: string): Promise<string>; applyVariant(v: string): void; setRewriteDialog(d: { original: string; variants: string[] } | null): void; historySave(action: string, response: string): void;
}) {
  const app = useApp();
  const review = async () => {
    if (!eligible.eligible) { app.notify(`材料不足：${eligible.reason}`); return; }
    const prompt = `你是小说审校员。按七维 ${reviewDimensions.join('、')} 审查以下文本，每项给 0-100 分、原文证据和理由。综合分对照用户自定义标尺《剑来》90分，仅用于同一量表，不假装已读到《剑来》全文。${comparator ? '对比文本：' + comparator : '没有导入对比文本，必须标注未做文本相似对比。'}\n作品事实与限制：\n${context}\n正文：\n${text}\n只返回 JSON: {"scores":{"逻辑性":0,"人物弧光":0,"情绪描写":0,"叙事流畅度":0,"语言文风":0,"节奏":0,"限制词":0},"overall":0,"issues":[{"quote":"原文证据","dimension":"维度","reason":"问题","suggestion":"建议"}],"plan":["修改步骤"]}`;
    const response = await run(prompt); if (!response) return; onRaw(response); historySave('整篇审查', response);
    try { onResult(extractJson(response) as ReviewResult); } catch (e) { app.notify(String(e)); }
  };
  const localReview = async () => {
    const target = selectedText.trim() || text.trim(); if (!target) { app.notify('请选择或输入需要审校的文本'); return; }
    const prompt = `请进行局部审校。核查事实、上下文、人物声线、情绪目标、文风和限制词。每条必须引用真实原文，不能编造证据。${focus ? '额外目标：' + focus : ''}\n作品资料：\n${context}\n上下文：\n${text.slice(0, 30000)}\n重点文本：\n${target}\n返回 JSON {"issues":[{"quote":"原文","dimension":"维度","reason":"问题","suggestion":"建议"}]}`;
    const response = await run(prompt); if (!response) return; onRaw(response); historySave('局部审校', response); try { onResult(extractJson(response) as ReviewResult); } catch (e) { app.notify(String(e)); }
  };
  const rewrite = async (quote?: string) => {
    const target = quote || selectedText.trim() || text.trim(); if (!target) { app.notify('先选择要修改的文本'); return; }
    onSelectedText(target);
    const prompt = `针对以下小说原文，在不改变关键事实和角色知情边界的前提下给出三种不同改写。第一种保守修复，第二种强化情绪，第三种加强叙事节奏。${focus ? '额外目标：' + focus : ''}\n作品约束：${context}\n原文：${target}\n只返回 JSON 数组，恰好三个字符串。`;
    const response = await run(prompt); if (!response) return; historySave('三案改写', response);
    try { const parsed = extractJson(response); if (!Array.isArray(parsed) || parsed.length !== 3 || parsed.some(x => typeof x !== 'string')) throw new Error('模型未返回三种文本'); setRewriteDialog(createRewriteProposal(target, parsed)); onRaw(response); } catch (e) { app.notify(String(e)); onRaw(response); }
  };
  const fullRewrite = async () => {
    if (!text.trim()) { app.notify('请先选择章节'); return; }
    const planText = result?.plan?.length ? `审校修改计划：\n${result.plan.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n` : '';
    const issuesText = result?.issues?.length ? `审校建议：\n${result.issues.map(i => `- ${i.dimension}：${i.suggestion}`).join('\n')}\n` : '';
    const response = await run(`按以下审校意见整篇修改，保留事实与关键情节，只返回改后正文：\n${planText}${issuesText}${focus ? '额外目标：' + focus + '\n' : ''}作品约束：${context}\n原文：${text}`);
    if (response) { onSelectedText(text); onVariants([response]); historySave('整篇修改', response); }
  };

  return <section className="paper-page">
    <div className="panel-heading"><h3>修改</h3></div>
    <p className="muted">整篇修改依据审查建议；局部问题定位修改按选中文本；三案改写以弹窗展示三种候选，选择其一替换。</p>
    <label>审校目标与限制<input value={focus} onChange={e => onFocus(e.target.value)} placeholder="例如：核对克制的悲伤、禁用解释式结尾" /></label>
    <label>导入对比对象文本<textarea className="small-textarea" value={comparator} onChange={e => onComparator(e.target.value)} placeholder="可粘贴剧本杀角色文本作为本地对比对象。未导入时只按评分量表审查。" /></label>
    <button className="button" onClick={async () => { try { const file = await platform().importText(); if (file) onComparator(file.text); } catch (e) { app.notify(String(e)); } }}><FileText size={15} />从文件导入对比文本</button>
    <div className="action-row" style={{ marginTop: 14 }}>
      <button className="button primary" disabled={busy} onClick={review}><Sparkles size={16} />{busy ? '审查中…' : '整篇审查'}</button>
      <button className="button" disabled={busy} onClick={localReview}><FileText size={16} />局部问题定位</button>
      <button className="button" disabled={busy} onClick={() => rewrite()}><RefreshCcw size={16} />三案改写</button>
      <button className="button" disabled={busy} onClick={fullRewrite}><WandSparkles size={16} />{busy ? '生成中…' : '整篇修改'}</button>
    </div>
    {!eligible.eligible && <div className="notice">材料不足：{eligible.reason} 局部问题定位和三案改写仍可使用。</div>}
    {result?.overall != null && <strong className="score">{result.overall} / 100</strong>}
    <p className="muted">《剑来》90 分为用户预设量表标尺。{comparator ? '已提供本地对比文本。' : '未做文本相似对比。'}</p>
    {result?.scores && <div className="score-grid">{reviewDimensions.map(d => <div key={d}><span>{d}</span><strong>{result.scores?.[d] ?? '—'}</strong><small>参考 90</small></div>)}</div>}
    {result?.issues?.map((issue, i) => <div className="issue-card" key={i}><span className="tiny-label">{issue.dimension}</span><blockquote>{issue.quote}</blockquote><p>{issue.reason}</p><small>{issue.suggestion}</small><button className="text-button" onClick={() => rewrite(issue.quote)}>针对原文生成三案<ArrowRight size={14} /></button></div>)}
    {result?.plan && <div className="plan-list"><h4>整体修改计划</h4>{result.plan.map((step, i) => <p key={i}>{i + 1}. {step}</p>)}</div>}
    {variants.length > 0 && <div className="variant-list"><h4>整篇修改预览</h4><button className="button primary" onClick={() => applyVariant(variants[0])}><Check size={15} />应用修改（先自动保留修改前版本）</button></div>}
    {raw && !result && !variants.length && <pre className="raw-result">{raw}</pre>}
    {!raw && !result && !variants.length && <div className="empty-small">选择整篇审查、局部问题定位、三案改写或整篇修改。</div>}
  </section>;
}

/* 读者模拟 */
function ReaderSimTab({ workId, chapters, run, busy }: { workId: string; chapters: Entity[]; run(prompt: string): Promise<string>; busy: boolean }) {
  const app = useApp();
  const [perspective, setPerspective] = useState(readerPerspectives[0]);
  const [checked, setChecked] = useState<string[]>([]);
  const [output, setOutput] = useState('');
  const simulate = async () => {
    const selected = chapters.filter(c => checked.includes(c.id));
    if (!selected.length) { app.notify('请先勾选要模拟的章节'); return; }
    const content = selected.map(c => `《${c.title}》\n${c.content}`).join('\n\n');
    const response = await run(`请以「${perspective}」视角阅读以下章节，给出该视角的真实阅读反馈。说明：第一印象、最关心的地方、看不懂或出戏的地方、期待后续发生什么、以及对作者的改进建议。不要复述情节。\n章节：\n${content}`);
    if (response) setOutput(response);
  };
  void workId; void busy;
  return <section className="paper-page">
    <div className="panel-heading"><h3>读者模拟</h3></div>
    <p className="muted">勾选章节，按小白读者、老书虫、编辑视角分别模拟反馈。</p>
    <label>模拟视角<select value={perspective} onChange={e => setPerspective(e.target.value)}>{readerPerspectives.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
    <div className="restriction-chips" style={{ marginTop: 14 }}>
      {chapters.map(c => <button key={c.id} className={`button ${checked.includes(c.id) ? 'primary' : ''}`} onClick={() => setChecked(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id])}>{c.title}</button>)}
    </div>
    <button className="button primary" disabled={busy} onClick={simulate}><Eye size={15} />{busy ? '模拟中…' : '开始模拟'}</button>
    {output && <div className="reader-sim-card" style={{ marginTop: 16 }}><h4>{perspective} 反馈</h4><p>{output}</p></div>}
  </section>;
}

/* 朱雀AI检测 */
function ZhuqueTab({ chapter, importedSection, text, context, run, busy }: { chapter?: Entity; importedSection?: { title: string }; text: string; context: string; run(prompt: string): Promise<string>; busy: boolean }) {
  const app = useApp();
  const [result, setResult] = useState<{ rates?: Record<string, number>; aiRate?: number | string; suggestions?: string[] } | null>(null);
  const [raw, setRaw] = useState('');
  const detect = async () => {
    if (!text.trim()) { app.notify('请先选择章节'); return; }
    const response = await run(`对以下章节做七维 AI 特征诊断：${zhuqueDimensions.join('、')}。每维给 0-100 特征分，列原文证据，给修改建议，并给出一个内部估算的"AI 率"（0-100）。该 AI 率仅是应用内部估算，绝不能当作作者身份鉴定。\n作品资料：\n${context}\n章节：\n${text}\n只返回 JSON: {"rates":{"${zhuqueDimensions.join('":0,"')}":0},"aiRate":0,"suggestions":["修改建议"]}`);
    if (!response) return; setRaw(response);
    try { setResult(extractJson(response) as typeof result); } catch (e) { app.notify(String(e)); }
  };
  void chapter; void importedSection;
  return <section className="paper-page">
    <div className="panel-heading"><h3>朱雀AI检测</h3></div>
    <p className="muted">选择章节后做七维特征诊断与修改建议；AI 率仅为内部估算。</p>
    <button className="button primary" disabled={busy} onClick={detect}><ShieldCheck size={15} />{busy ? '检测中…' : '开始检测'}</button>
    <div className="ai-rate-banner">AI 率仅是应用内部估算，用于提示可编辑的写作特征，不能作为作者身份鉴定，也不应据此判断作品由谁创作。</div>
    {result?.rates && <div className="zhuque-dim">{zhuqueDimensions.map(d => <div key={d}><span>{d}</span><strong>{result.rates?.[d] ?? '—'}</strong><small>特征分越高，越接近该维度的常见 AI 写作痕迹。</small></div>)}</div>}
    {result && result.aiRate != null && <p><strong>内部估算 AI 率：</strong>{result.aiRate}%</p>}
    {result?.suggestions && <div className="plan-list"><h4>修改建议</h4>{result.suggestions.map((s, i) => <p key={i}>{i + 1}. {s}</p>)}</div>}
    {!result && raw && <pre className="raw-result">{raw}</pre>}
  </section>;
}

/* 三案改写弹窗 */
function RewriteDialog({ original, variants, onApply, onClose }: { original: string; variants: string[]; onApply(v: string): void; onClose(): void }) {
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-card" onClick={e => e.stopPropagation()}>
      <div className="panel-heading"><h3>三案改写</h3><button className="icon-button" onClick={onClose} title="关闭"><X size={16} /></button></div>
      <p className="muted">选择一种修改建议替换原文；原文会在应用前自动保存。</p>
      {variants.map((variant, i) => <div key={i} className="variant-card"><span>方案 {i + 1}</span><p>{variant}</p><button className="button primary" onClick={() => onApply(variant)}><Check size={15} />选择此方案替换</button></div>)}
      <p className="muted" style={{ marginTop: 12 }}>原文：{original.slice(0, 120)}…</p>
    </div>
  </div>;
}
