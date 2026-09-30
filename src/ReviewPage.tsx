import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Download, Eye, FileText, RefreshCcw, ShieldCheck, Sparkles, Trash2, WandSparkles, X } from 'lucide-react';
import { useApp } from './context';
import { listEntities, type Entity } from './store';
import { platform } from './platform';
import { availableModels, extractJson, modelFromProvider, pickModel, workContext } from './ai';
import { createRewriteProposal, reviewDimensions, reviewEligibility, reviewRoles, roleFocus, redlineRules, gradeBand, type ReviewRole, type ReviewRedline, type ReviewContinuity } from './review';
import { splitImportedChapters } from './importedChapters';
import { restrictionTypes } from './restrictions';
import { readerPerspectives } from './readerAgents';

type Issue = { severity?: string; quote: string; dimension: string; reason: string; suggestion: string };
type ChapterReview = { overall?: number; grade?: string; gradeHint?: string; scores?: Record<string, number>; roles?: ReviewRole[]; redlines?: ReviewRedline[]; continuity?: ReviewContinuity[]; summary?: string; deviations?: string[]; aiTrace?: string[]; issues?: Issue[] };
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
const zhuqueDimensions = ['困惑度', '爆发性', '连贯性', '重复度', '句长规律性', '情感一致性', '结构模板化'];
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
  if (!Array.isArray(value)) return [{ role: '', phases: [{ from: '', to: '', intensity: '' }] }];
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
        <p className="muted">每行选择一名角色；每个「列」是一段情绪变化：情绪词 → 情绪词 → 强度（大小），可增删列与行。</p>
        <datalist id="polish-characters">{characterNames.map(name => <option key={name} value={name} />)}</datalist>
        <datalist id="polish-emotions">{emotionSuggestions.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="polish-intensity">{intensitySuggestions.map(x => <option key={x} value={x} />)}</datalist>
        <div className="polish-emotion-rows">
          {emotionTargets.map((row, rowIndex) => <div className="polish-emotion-row" key={rowIndex}>
            <select className="emotion-role" aria-label="目标角色" value={row.role} onChange={e => setEmotionTargets(rows => rows.map((v, i) => i === rowIndex ? { ...v, role: e.target.value } : v))}><option value="">选择角色</option>{characterNames.map(name => <option key={name} value={name}>{name}</option>)}</select>
            <div className="emotion-columns">
              {row.phases.map((phase, i) => <div className="emotion-col" key={i}>
                <input list="polish-emotions" aria-label={`第${i + 1}列起始情绪词`} value={phase.from} onChange={e => setEmotionTargets(rows => rows.map((v, n) => n === rowIndex ? { ...v, phases: v.phases.map((p, j) => j === i ? { ...p, from: e.target.value } : p) } : v))} placeholder="情绪词·悲伤" />
                <span className="emotion-arrow">→</span>
                <input list="polish-emotions" aria-label={`第${i + 1}列目标情绪词`} value={phase.to} onChange={e => setEmotionTargets(rows => rows.map((v, n) => n === rowIndex ? { ...v, phases: v.phases.map((p, j) => j === i ? { ...p, to: e.target.value } : p) } : v))} placeholder="情绪词·开心" />
                <span className="emotion-arrow">→</span>
                <input list="polish-intensity" aria-label={`第${i + 1}列强度`} value={phase.intensity} onChange={e => setEmotionTargets(rows => rows.map((v, n) => n === rowIndex ? { ...v, phases: v.phases.map((p, j) => j === i ? { ...p, intensity: e.target.value } : p) } : v))} placeholder="大小" />
                <button className="icon-button danger" title="删除这一列" onClick={() => setEmotionTargets(rows => rows.map((v, n) => n === rowIndex ? { ...v, phases: v.phases.filter((_, j) => j !== i) } : v))}>×</button>
              </div>)}
              <button className="button emotion-add-phase" onClick={() => setEmotionTargets(rows => rows.map((v, n) => n === rowIndex ? { ...v, phases: [...v.phases, { from: '', to: '', intensity: '' }] } : v))}>+ 列</button>
            </div>
            <button className="icon-button danger" title="删除角色行" onClick={() => setEmotionTargets(rows => rows.filter((_, n) => n !== rowIndex))}><Trash2 size={15} /></button>
          </div>)}
        </div>
        <button className="button" onClick={() => setEmotionTargets(rows => [...rows, { role: '', phases: [{ from: '', to: '', intensity: '' }] }])}>+ 行</button>
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
  const [tab, setTab] = useState<'review' | 'edit' | 'reader' | 'zhuque'>('review');
  const [sourceId, setSourceId] = useState(app.workId ? `work:${app.workId}` : works[0] ? `work:${works[0].id}` : '');
  const workId = sourceId.startsWith('work:') ? sourceId.slice(5) : '';
  const chapters = listEntities(app.state, { kind: 'chapter', workId: workId || '__none__' });
  const [modelId, setModelId] = useState('');
  const providers = availableModels(app.state.entities);
  const selectedProvider = providers.find(p => p.id === modelId) ?? pickModel(app.state.entities, '评审') ?? providers[0];
  const context = workContext(app.state.entities, workId || app.workId, app.state.preferences.contextLimit);

  const [busy, setBusy] = useState(false);
  const run = async (prompt: string) => { const model = modelFromProvider(selectedProvider); if (!model) { app.notify('请先在 AI 配置中添加模型和密钥'); return ''; } setBusy(true); try { return await platform().runAi({ ...model, prompt }); } catch (e) { app.notify(String(e)); return ''; } finally { setBusy(false); } };

  const selectSource = (value: string) => { setSourceId(value); };

  return <><div className="page-intro"><div><span className="eyebrow">REVIEW / EVIDENCE</span><h2>审查修改</h2><p>章节评审、修改与替换、读者模拟与朱雀 AI 检测。</p></div></div>
    <div className="review-tabs">
      {([['review', '审查 · 章节评审', Sparkles], ['edit', '修改', WandSparkles], ['reader', '读者模拟', Eye], ['zhuque', '朱雀AI检测', ShieldCheck]] as const).map(([key, label, Icon]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}><Icon size={16} />{label}</button>)}
    </div>
    <div className="selector-strip">
      <label>作品<select value={sourceId} onChange={e => selectSource(e.target.value)}><option value="">未选择作品</option>{works.map(w => <option key={w.id} value={`work:${w.id}`}>{w.title}</option>)}</select></label>
      <label>使用模型<select value={modelId} onChange={e => setModelId(e.target.value)}><option value="">{providers[0]?.title ?? '请先配置模型'}</option>{providers.map(p => <option key={p.id} value={p.id}>{p.title} · {String(p.meta.model ?? '')}</option>)}</select></label>
    </div>
    {tab === 'review' && <ChapterReviewTab workId={workId} chapters={chapters} context={context} run={run} />}
    {tab === 'edit' && <EditTab workId={workId} chapters={chapters} context={context} />}
    {tab === 'reader' && <ReaderSimTab chapters={chapters} context={context} />}
    {tab === 'zhuque' && <ZhuqueTab chapters={chapters} context={context} run={run} busy={busy} />}
  </>;
}

/* 审查页：StarWriter 章节评审（评审中心 + 沉浸式视图） */
function ChapterReviewTab({ workId, chapters, context, run }: { workId: string; chapters: Entity[]; context: string; run(prompt: string): Promise<string> }) {
  const app = useApp();
  const reviews = listEntities(app.state, { kind: 'review', workId }).filter(r => r.parentId);
  const byChapter = new Map(reviews.map(r => [String(r.parentId), r]));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busyChapter, setBusyChapter] = useState('');
  const activeChapter = chapters.find(c => c.id === activeId);
  const activeReview = activeId ? byChapter.get(activeId) : undefined;
  const [body, setBody] = useState('');

  useEffect(() => { setBody(activeChapter?.content ?? ''); }, [activeId, activeChapter?.id]);

  const reviewChapter = async (chapter: Entity) => {
    if (busyChapter) return;
    const roleSpec = reviewRoles.map(r => `${r.role}(${Math.round(r.weight * 100)}%)看${roleFocus[r.role]}`).join('；');
    const redSpec = redlineRules.map(r => `${r.level}·${r.rule}`).join('；');
    const prompt = `你是小说审校团，按 5 个角色分别评审本章，再按权重合成综合分。${roleSpec}。\n另给${reviewDimensions.join('、')}六维分。\n对照作品资料（大纲/细纲/设定/伏笔）做连贯性检查：本章目标、要埋的钩子、人物前后状态、要回收的伏笔，逐条指出「预期 vs 实际」的偏差。\n红线命中：${redSpec}。\n评分档位：90-100精品 / 85-89优秀可发 / 75-84良好小改可发 / 60-74合格需改 / <60重写。材料不足时降低综合分并说明缺口。\n作品资料：\n${context}\n章节：\n${chapter.content}\n只返回 JSON: {"overall":0,"grade":"档位","gradeHint":"可发/小改可发/需改/重写","scores":{"${reviewDimensions.join('":0,"')}":0},"roles":[{"role":"阅读者","weight":0.25,"score":0,"opinion":"意见","quote":"原文证据"}],"redlines":[{"level":"P0","rule":"规则","quote":"原文","reason":"原因","suggestion":"建议"}],"continuity":[{"kind":"人物状态/钩子/伏笔/目标","expect":"预期","actual":"实际","quote":"原文","suggestion":"建议"}],"summary":"综述","deviations":["设定偏离"],"aiTrace":["AI痕迹"],"issues":[{"severity":"严重","quote":"原文证据","dimension":"维度","reason":"问题","suggestion":"建议"}]}`;
    setBusyChapter(chapter.id);
    try { const response = await run(prompt); if (!response) return; app.add('review', `${chapter.title} · 审查`, response, { workId: workId || undefined, parentId: chapter.id, meta: { createdAt: new Date().toISOString() } }); app.notify(`已评审《${chapter.title}》`); } finally { setBusyChapter(''); }
  };

  const parse = (r: Entity): ChapterReview => { try { return extractJson(r.content) as ChapterReview; } catch { return {}; } };
  const data = activeReview ? parse(activeReview) : {};
  const saveBody = () => { if (!activeChapter) return; app.add('snapshot', `${activeChapter.title} · 修改前`, activeChapter.content, { workId, parentId: activeChapter.id }); app.update(activeChapter.id, { content: body }); app.notify('正文已保存，并保留修改前版本'); };
  const locate = (quote: string) => { const idx = body.indexOf(quote); if (idx < 0) { app.notify('未匹配到原文，请手动查看'); return; } const el = document.getElementById('review-chapter-body') as HTMLTextAreaElement | null; if (el) { el.focus(); el.setSelectionRange(idx, idx + quote.length); } };

  return <section className="paper-page">
    <div className="panel-heading"><h3>AI 评审中心</h3><span>已评审 {reviews.length} / {chapters.length} 章</span></div>
    <p className="muted">选择章节进入沉浸式评审：左侧正文、右侧综合分／综述／设定偏离／痕迹分析／问题明细，点击问题可定位原文。</p>
    <div className="chapter-review-list">
      {chapters.map(c => { const r = byChapter.get(c.id); const d = r ? parse(r) : {}; return <button key={c.id} className={`chapter-review-row ${activeId === c.id ? 'active' : ''}`} onClick={() => setActiveId(c.id)}>
        <span className="chapter-review-title">{c.title}</span>
        <span>{c.content.replace(/\s/g, '').length} 字</span>
        <strong className="review-score">{d.overall != null ? `${d.overall} / 100${d.grade ? ` · ${d.grade}` : ''}` : '未评审'}</strong>
        <span className="chapter-review-summary">{d.summary ?? ''}</span>
        <button className="button" disabled={busyChapter === c.id} onClick={e => { e.stopPropagation(); reviewChapter(c); }}><Sparkles size={14} />{busyChapter === c.id ? '评审中…' : '评审'}</button>
      </button>; })}
      {!chapters.length && <div className="empty-small">当前作品还没有章节，先在正文页建立章节。</div>}
    </div>

    {activeChapter && <div className="review-immersive">
      <div className="panel-heading">
        <h3>{activeChapter.title} · 章节评审</h3>
        <div className="action-row">
          {data.overall != null && <strong className="score">综合分 {data.overall} / 100 · {data.grade ?? gradeBand(data.overall).grade}（{data.gradeHint ?? gradeBand(data.overall).hint}）</strong>}
          <button className="button primary" onClick={saveBody}><Check size={15} />保存正文</button>
        </div>
      </div>
      <div className="review-immersive-grid">
        <div className="review-immersive-body">
          <div className="panel-heading"><h4>章节正文</h4><span>{body.replace(/\s/g, '').length} 字</span></div>
          <textarea id="review-chapter-body" className="chapter-textarea" value={body} onChange={e => setBody(e.target.value)} />
        </div>
        <div className="review-immersive-result">
          {activeReview ? <div>
            {data.summary && <div className="review-block"><h4>综述</h4><p>{data.summary}</p></div>}
            {data.roles && data.roles.length > 0 && <div className="review-block"><h4>五角色加权评审</h4>{data.roles.map((r, i) => <div className="role-row" key={i}><span className="role-name">{r.role}（{Math.round(r.weight * 100)}%）</span><strong className="role-score">{r.score}</strong><p>{r.opinion}</p>{r.quote && <button className="text-button" onClick={() => locate(r.quote)}>定位<ArrowRight size={12} /></button>}</div>)}</div>}
            {data.redlines && data.redlines.length > 0 && <div className="review-block"><h4>红线命中</h4>{data.redlines.map((r, i) => <div className={`redline-row ${r.level}`} key={i}><span className={`tiny-label severity-badge ${r.level === 'P0' ? '严重' : '轻微'}`}>{r.level}</span><strong>{r.rule}</strong><button className="text-button" onClick={() => locate(r.quote)}>定位<ArrowRight size={12} /></button><blockquote>{r.quote}</blockquote><p>{r.reason}</p><small>建议：{r.suggestion}</small></div>)}</div>}
            {data.continuity && data.continuity.length > 0 && <div className="review-block"><h4>连贯性对照（预期 vs 实际）</h4>{data.continuity.map((c, i) => <div className="continuity-row" key={i}><span className="tiny-label">{c.kind}</span><p><strong>预期：</strong>{c.expect}</p><p><strong>实际：</strong>{c.actual}</p>{c.quote && <button className="text-button" onClick={() => locate(c.quote)}>定位<ArrowRight size={12} /></button>}<small>建议：{c.suggestion}</small></div>)}</div>}
            {data.scores && <div className="score-grid">{reviewDimensions.map(d => <div key={d}><span>{d}</span><strong>{data.scores?.[d] ?? '—'}</strong></div>)}</div>}
            {data.deviations && data.deviations.length > 0 && <div className="review-block"><h4>设定偏离项</h4>{data.deviations.map((x, i) => <p key={i} className="review-deviation">{x}</p>)}</div>}
            {data.aiTrace && data.aiTrace.length > 0 && <div className="review-block"><h4>痕迹分析</h4>{data.aiTrace.map((x, i) => <span key={i} className="ai-trace">{x}</span>)}</div>}
            <div className="review-block"><h4>问题明细</h4>
              {data.issues?.length ? data.issues.map((issue, i) => <div className={`issue-card severity-${issue.severity ?? '其他'}`} key={i}>
                <div className="action-row"><span className={`tiny-label severity-badge ${issue.severity ?? '其他'}`}>{issue.severity ?? '其他'}</span><span className="tiny-label">{issue.dimension}</span><button className="text-button" onClick={() => locate(issue.quote)}>定位原文<ArrowRight size={13} /></button></div>
                <blockquote>{issue.quote}</blockquote><p>{issue.reason}</p><small>建议：{issue.suggestion}</small>
              </div>) : <div className="empty-small">本次审查未发现明细问题。</div>}
            </div>
          </div> : <div className="empty-small">点击上方「评审」生成评审结果。</div>}
        </div>
      </div>
    </div>}
  </section>;
}

/* 修改页：整篇修改 + 局部问题标注定位批注 + 三案改写弹窗 */
function EditTab({ workId, chapters, context }: { workId: string; chapters: Entity[]; context: string }) {
  const app = useApp();
  const agents = listEntities(app.state, { kind: 'agent' });
  const skills = listEntities(app.state, { kind: 'skill' });
  const providers = availableModels(app.state.entities);
  const [chapterId, setChapterId] = useState(chapters[0]?.id ?? '');
  const chapter = chapters.find(c => c.id === chapterId);
  const [text, setText] = useState(chapter?.content ?? '');
  const [selectedText, setSelectedText] = useState('');
  const [modelId, setModelId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [focus, setFocus] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [rewriteDialog, setRewriteDialog] = useState<{ original: string; variants: string[] } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setText(chapter?.content ?? ''); setSelectedText(''); setIssues([]); }, [chapterId, chapter?.id]);

  const agent = agents.find(a => a.id === agentId);
  const agentSkill = skills.find(s => s.id === agent?.meta.skillId);
  const editSkill = skills.find(s => s.id === skillId);
  const provider = providers.find(p => p.id === (modelId || String(agent?.meta.providerId ?? ''))) ?? providers[0];
  const model = modelFromProvider(provider);

  const [busyEdit, setBusyEdit] = useState(false);
  const run2 = async (prompt: string) => { if (!model) { app.notify('请先在 AI 配置中添加模型和密钥'); return ''; } setBusyEdit(true); try { return await platform().runAi({ ...model, prompt }); } catch (e) { app.notify(String(e)); return ''; } finally { setBusyEdit(false); } };

  const agentContext = [agent ? `Agent 职责：${agent.content}` : '', agentSkill ? `Agent Skill：${agentSkill.content}` : '', editSkill ? `修改用 Skill：${editSkill.content}` : ''].filter(Boolean).join('\n');

  const locate = (quote: string) => { const idx = text.indexOf(quote); if (idx < 0) { app.notify('未匹配到原文，请手动查看'); return; } const el = textRef.current; if (el) { el.focus(); el.setSelectionRange(idx, idx + quote.length); } };

  const fullReview = async () => {
    if (!text.trim()) { app.notify('请先选择章节'); return; }
    if (!reviewEligibility(text).eligible) { app.notify(reviewEligibility(text).reason!); return; }
    const response = await run2(`你是小说审校员。整篇审查以下文本，给出问题明细（每条含原文证据、维度、原因、建议与严重程度）。\n作品资料：${context}\n${agentContext}\n${focus ? '额外目标：' + focus : ''}\n正文：${text}\n只返回 JSON {"issues":[{"severity":"严重|轻微|其他","quote":"原文","dimension":"维度","reason":"问题","suggestion":"建议"}]}`);
    if (!response) return;
    try { setIssues((extractJson(response) as { issues?: Issue[] }).issues ?? []); } catch (e) { app.notify(String(e)); }
  };

  const localAnnotate = async () => {
    const target = selectedText.trim() || text.trim();
    if (!target) { app.notify('请先选中要标注的原文片段'); return; }
    const response = await run2(`对以下选中片段做局部问题标注。逐条指出问题所在的原文位置（quote 必须逐字来自片段）、维度、原因和批注修改意见。\n作品资料：${context}\n${agentContext}\n${focus ? '额外目标：' + focus : ''}\n选中片段：${target}\n只返回 JSON {"issues":[{"severity":"严重|轻微|其他","quote":"原文","dimension":"维度","reason":"问题","suggestion":"批注修改意见"}]}`);
    if (!response) return;
    try { setIssues((extractJson(response) as { issues?: Issue[] }).issues ?? []); } catch (e) { app.notify(String(e)); }
  };

  const threeRewrite = async (quote?: string) => {
    const target = quote || selectedText.trim() || text.trim();
    if (!target) { app.notify('先选择要修改的文本'); return; }
    setSelectedText(target);
    const response = await run2(`针对以下小说原文，在不改变关键事实和角色知情边界的前提下给出三种不同改写。第一种保守修复，第二种强化情绪，第三种加强叙事节奏。${focus ? '额外目标：' + focus : ''}\n作品约束：${context}\n${agentContext}\n原文：${target}\n只返回 JSON 数组，恰好三个字符串。`);
    if (!response) return;
    try { const parsed = extractJson(response); if (!Array.isArray(parsed) || parsed.length !== 3 || parsed.some(x => typeof x !== 'string')) throw new Error('模型未返回三种文本'); setRewriteDialog(createRewriteProposal(target, parsed)); } catch (e) { app.notify(String(e)); }
  };

  const fullRewrite = async () => {
    if (!text.trim()) { app.notify('请先选择章节'); return; }
    const suggestion = issues.map(i => `- ${i.dimension}：${i.suggestion}`).join('\n');
    const response = await run2(`按以下审校意见整篇修改，保留事实与关键情节，只返回改后正文：\n${suggestion || '（暂无意见，请先整篇审查或局部标注）'}\n${focus ? '额外目标：' + focus + '\n' : ''}作品约束：${context}\n${agentContext}\n原文：${text}`);
    if (response) { setSelectedText(text); setRewriteDialog({ original: text, variants: [response] }); }
  };

  const applyVariant = (variant: string) => {
    const original = rewriteDialog?.original ?? selectedText;
    if (!original || !text.includes(original)) { app.notify('原文已改变，请重新选择文本'); setRewriteDialog(null); return; }
    const next = text.replace(original, variant);
    if (chapter) { app.add('snapshot', `${chapter.title} · 修改前`, chapter.content, { workId, parentId: chapter.id }); app.update(chapter.id, { content: next }); }
    setText(next); setSelectedText(''); setRewriteDialog(null); app.notify('已替换，并保存修改前版本');
  };

  return <section className="paper-page">
    <div className="panel-heading"><h3>修改</h3><span>整篇修改 · 局部问题标注定位 · 三案改写</span></div>
    <div className="selector-strip">
      <label>章节<select value={chapterId} onChange={e => setChapterId(e.target.value)}><option value="">自定义文本</option>{chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>模型<select value={modelId || String(agent?.meta.providerId ?? '')} onChange={e => setModelId(e.target.value)}><option value="">{provider ? `${provider.title} · ${String(provider.meta.model ?? '')}` : '请先配置模型'}</option>{providers.map(p => <option key={p.id} value={p.id}>{p.title} · {String(p.meta.model ?? '')}</option>)}</select></label>
      <label>Agent<select value={agentId} onChange={e => setAgentId(e.target.value)}><option value="">不使用 Agent</option>{agents.map(a => <option key={a.id} value={a.id}>{a.category} · {a.title}</option>)}</select></label>
      <label>修改用 Skill<select value={skillId} onChange={e => setSkillId(e.target.value)}><option value="">不使用 Skill</option>{skills.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
    </div>
    <label>修改目标与限制<input value={focus} onChange={e => setFocus(e.target.value)} placeholder="例如：核对克制的悲伤、禁用解释式结尾" /></label>
    <textarea ref={textRef} className="source-textarea" value={text} onChange={e => setText(e.target.value)} onSelect={e => { const t = e.currentTarget; setSelectedText(t.value.slice(t.selectionStart, t.selectionEnd)); }} placeholder="选择章节或粘贴文本；选中片段后可做局部标注或三案改写。" />
    <div className="action-row" style={{ marginTop: 14 }}>
      <button className="button primary" disabled={busyEdit} onClick={fullRewrite}><WandSparkles size={16} />{busyEdit ? '生成中…' : '整篇修改'}</button>
      <button className="button" disabled={busyEdit} onClick={localAnnotate}><FileText size={16} />局部问题标注</button>
      <button className="button" disabled={busyEdit} onClick={() => threeRewrite()}><RefreshCcw size={16} />三案改写</button>
      <button className="button" disabled={busyEdit} onClick={fullReview}><Sparkles size={16} />整篇审查</button>
    </div>
    <p className="muted" style={{ marginTop: 10 }}>先「整篇审查」或「局部问题标注」生成问题清单，点击问题可定位原文；再「整篇修改」按意见生成整篇改写，或「三案改写」逐条替换。</p>
    {issues.length > 0 && <div className="plan-list"><h4>问题与批注（{issues.length} 条，点击定位原文）</h4>{issues.map((issue, i) => <div className={`issue-card severity-${issue.severity ?? '其他'}`} key={i}>
      <div className="action-row"><span className={`tiny-label severity-badge ${issue.severity ?? '其他'}`}>{issue.severity ?? '其他'}</span><span className="tiny-label">{issue.dimension}</span><button className="text-button" onClick={() => locate(issue.quote)}>定位原文<ArrowRight size={13} /></button><button className="text-button" onClick={() => threeRewrite(issue.quote)}>三案改写<ArrowRight size={13} /></button></div>
      <blockquote>{issue.quote}</blockquote><p>{issue.reason}</p><small>批注：{issue.suggestion}</small>
    </div>)}</div>}
    {rewriteDialog && <RewriteDialog original={rewriteDialog.original} variants={rewriteDialog.variants} onApply={applyVariant} onClose={() => setRewriteDialog(null)} />}
  </section>;
}

/* 读者模拟：三个固定 reader Agent */
function ReaderSimTab({ chapters, context }: { chapters: Entity[]; context: string }) {
  const app = useApp();
  const agents = listEntities(app.state, { kind: 'agent' }).filter(a => a.category === '读者');
  const skills = listEntities(app.state, { kind: 'skill' });
  const providers = availableModels(app.state.entities);
  const [checked, setChecked] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<string[]>([]);

  const simulate = async (agent: Entity) => {
    const selected = chapters.filter(c => checked.includes(c.id));
    if (!selected.length) { app.notify('请先勾选要模拟的章节'); return; }
    const skill = skills.find(s => s.id === agent.meta.skillId);
    const provider = providers.find(p => p.id === agent.meta.providerId) ?? pickModel(app.state.entities, '读者') ?? providers[0];
    const model = modelFromProvider(provider);
    if (!model) { app.notify(`${agent.title} 未配置可用模型，请先在 Agent 技能树绑定`); return; }
    setRunning(xs => [...xs, agent.id]);
    try {
      const content = selected.map(c => `《${c.title}》\n${c.content}`).join('\n\n');
      const response = await platform().runAi({ ...model, prompt: `${skill?.content ?? `你正在扮演「${agent.title}」。${agent.content}。`}\n作品资料：\n${context}\n章节：\n${content}` });
      setOutputs(o => ({ ...o, [agent.id]: response }));
    } catch (e) { app.notify(String(e)); } finally { setRunning(xs => xs.filter(id => id !== agent.id)); }
  };

  return <section className="paper-page">
    <div className="panel-heading"><h3>读者模拟</h3><span>三个固定读者 Agent · 在 Agent 技能树管理模型与 Skill</span></div>
    <p className="muted">勾选章节，选择读者身份分别模拟反馈。视角与维度来自 Agent 技能树中的三个内置「读者」Agent。</p>
    <div className="restriction-chips" style={{ margin: '12px 0' }}>
      {chapters.map(c => <button key={c.id} className={`button ${checked.includes(c.id) ? 'primary' : ''}`} onClick={() => setChecked(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id])}>{c.title}</button>)}
    </div>
    <div className="reader-sim-grid">
      {readerPerspectives.map(p => {
        const agent = agents.find(a => a.meta.readerKey === p.key);
        if (!agent) return null;
        const runningThis = running.includes(agent.id);
        return <article className="reader-sim-card" key={p.key}>
          <div className="action-row"><span style={{ fontSize: 22 }}>{p.icon}</span><h4>{p.name}</h4></div>
          <p className="muted">{p.desc}</p>
          <small>维度：{p.dimensions.join(' · ')}</small>
          <div style={{ marginTop: 12 }}><button className="button primary" disabled={runningThis} onClick={() => simulate(agent)}><Eye size={15} />{runningThis ? '模拟中…' : '模拟反馈'}</button></div>
          {outputs[agent.id] && <div className="reader-sim-feedback"><p>{outputs[agent.id]}</p></div>}
        </article>;
      })}
    </div>
  </section>;
}

/* 朱雀AI检测：七维特征 + AI率阈值 */
function ZhuqueTab({ chapters, context, run, busy }: { chapters: Entity[]; context: string; run(prompt: string): Promise<string>; busy: boolean }) {
  const app = useApp();
  const [chapterId, setChapterId] = useState(chapters[0]?.id ?? '');
  const chapter = chapters.find(c => c.id === chapterId);
  const [result, setResult] = useState<{ rates?: Record<string, number>; aiRate?: number | string; suggestions?: string[] } | null>(null);
  const [raw, setRaw] = useState('');
  const detect = async () => {
    if (!chapter?.content) { app.notify('请先选择章节'); return; }
    const response = await run(`对以下章节做七维 AI 特征诊断：${zhuqueDimensions.join('、')}。每维给 0-100 特征分并附原文证据，给修改建议，再给出内部估算的 AI 率（0-100）。参考阈值：<20% 人写，20%-50% 明显润色，>70% 易被平台识别；该 AI 率仅为内部估算，不能作为作者身份鉴定。\n作品资料：${context}\n章节：${chapter.content}\n只返回 JSON: {"rates":{"${zhuqueDimensions.join('":0,"')}":0},"aiRate":0,"suggestions":["降AI改法"]}`);
    if (!response) return; setRaw(response);
    try { setResult(extractJson(response) as typeof result); } catch (e) { app.notify(String(e)); }
  };
  return <section className="paper-page">
    <div className="panel-heading"><h3>朱雀AI检测过审</h3></div>
    <p className="muted">采用行业检测原理（困惑度/爆发性/连贯性等七维特征分析）评测章节，参考 AI 率阈值：&lt;20% 人写，20%-50% 明显润色，&gt;70% 易被平台识别。</p>
    <label>章节<select value={chapterId} onChange={e => setChapterId(e.target.value)}>{chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
    <div style={{ marginTop: 12 }}><button className="button primary" disabled={busy} onClick={detect}><ShieldCheck size={15} />{busy ? '检测中…' : '开始检测'}</button></div>
    <div className="ai-rate-banner">AI 率仅是应用内部估算，用于提示可编辑的写作特征，不能作为作者身份鉴定，也不应据此判断作品由谁创作。</div>
    {result?.rates && <div className="zhuque-dim">{zhuqueDimensions.map(d => <div key={d}><span>{d}</span><strong>{result.rates?.[d] ?? '—'}</strong><small>特征分越高，越接近该维度的常见 AI 写作痕迹。</small></div>)}</div>}
    {result && result.aiRate != null && <p><strong>内部估算 AI 率：</strong>{result.aiRate}%</p>}
    {result?.suggestions && <div className="plan-list"><h4>降 AI 改稿建议</h4>{result.suggestions.map((s, i) => <p key={i}>{i + 1}. {s}</p>)}</div>}
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
