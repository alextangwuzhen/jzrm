import { useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from './context';
import { listEntities, type Entity } from './store';
import { modelFromProvider, pickModel, workContext } from './ai';
import { platform } from './platform';
import { foreshadowCounts, foreshadowStatuses, readForeshadowStatus, type ForeshadowStatus } from './foreshadow';

export function ForeshadowPage({ work }: { work: Entity }) {
  const app = useApp();
  const items = listEntities(app.state, { kind: 'setting', workId: work.id, category: 'foreshadow' });
  const chapters = listEntities(app.state, { kind: 'chapter', workId: work.id });
  const [filter, setFilter] = useState<'全部' | ForeshadowStatus>('全部');
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState('');

  const counts = foreshadowCounts(items);
  const filtered = items.filter(i => filter === '全部' || readForeshadowStatus(i.meta) === filter);

  const add = () => {
    app.add('setting', '新伏笔', '', { workId: work.id, parentId: work.id, category: 'foreshadow', meta: { status: '埋设', plantChapter: '', revealChapter: '' } });
  };
  const setStatus = (item: Entity, status: ForeshadowStatus) => app.update(item.id, { meta: { ...item.meta, status } });
  const setMeta = (item: Entity, patch: Record<string, unknown>) => app.update(item.id, { meta: { ...item.meta, ...patch } });

  const aiFill = async () => {
    const m = modelFromProvider(pickModel(app.state.entities, '辅助'));
    if (!m) { app.notify('请先配置辅助模型'); return; }
    setBusy(true);
    try {
      const context = workContext(app.state.entities, work.id, app.state.preferences.contextLimit);
      const existing = items.map(i => `${i.title}（${readForeshadowStatus(i.meta)}）：${i.content}`).join('\n');
      const response = await platform().runAi({
        ...m,
        prompt: `为作品「${work.title}」梳理伏笔。根据正文与设定，列出尚未揭示的伏笔候选（埋设），以及可标记为揭示或废弃的已有伏笔。每项给「名称」「内容」「状态（埋设/揭示/废弃）」。只依据已知内容，不凭空造情节。已有伏笔：\n${existing || '（暂无）'}\n作品资料：\n${context}`
      });
      setSuggestion(response);
      app.notify('AI 伏笔提案已生成，可复制到下面手动添加');
    } catch (e) { app.notify(String(e)); } finally { setBusy(false); }
  };

  return <>
    <div className="section-actions">
      <div><h3>伏笔追踪</h3><p className="muted">标记每条伏笔的埋设、揭示与废弃状态，按状态筛选并查看回收率。</p></div>
      <div className="action-row">
        <button className="button" disabled={busy} onClick={aiFill}><Sparkles size={15} />{busy ? '梳理中…' : 'AI 填充'}</button>
        <button className="button primary" onClick={add}><Plus size={15} />添加伏笔</button>
      </div>
    </div>

    <div className="foreshadow-stats">
      <span>埋设 <strong>{counts.planted}</strong></span>
      <span>揭示 <strong>{counts.revealed}</strong></span>
      <span>废弃 <strong>{counts.discarded}</strong></span>
      <span>回收率 <strong>{counts.rate == null ? '—' : `${counts.rate}%`}</strong></span>
    </div>

    <div className="category-tabs">
      <button className={filter === '全部' ? 'selected' : ''} onClick={() => setFilter('全部')}>全部</button>
      {foreshadowStatuses.map(status => <button key={status} className={filter === status ? 'selected' : ''} onClick={() => setFilter(status)}>{status}</button>)}
    </div>

    <datalist id="foreshadow-chapters">{chapters.map(c => <option key={c.id} value={c.title} />)}</datalist>

    <div className="foreshadow-list">
      {filtered.map(item => {
        const status = readForeshadowStatus(item.meta);
        return <article className="foreshadow-row" key={item.id}>
          <div className="foreshadow-main">
            <input value={item.title} onChange={e => app.update(item.id, { title: e.target.value })} aria-label="伏笔名称" />
            <label>状态
              <select value={status} onChange={e => setStatus(item, e.target.value as ForeshadowStatus)}>
                {foreshadowStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label>伏笔内容<textarea value={item.content} onChange={e => app.update(item.id, { content: e.target.value })} placeholder="在何处埋下、如何呼应、涉及哪些角色与情节" /></label>
          <div>
            <label>埋设章节<input list="foreshadow-chapters" value={String(item.meta.plantChapter ?? '')} onChange={e => setMeta(item, { plantChapter: e.target.value })} placeholder="选择或输入" /></label>
            <label>揭示章节<input list="foreshadow-chapters" value={String(item.meta.revealChapter ?? '')} onChange={e => setMeta(item, { revealChapter: e.target.value })} placeholder="选择或输入" /></label>
          </div>
          <button className="icon-button danger" title="移入垃圾箱" onClick={() => app.trash(item.id)}><Trash2 size={16} /></button>
        </article>;
      })}
    </div>
    {!filtered.length && <div className="empty-small">这个状态还没有伏笔。可手动添加，或导入设定文档自动同步。</div>}

    {suggestion && <section className="paper-page"><div className="panel-heading"><h3>AI 伏笔提案</h3><button className="button" onClick={() => setSuggestion('')}>关闭</button></div><textarea value={suggestion} onChange={e => setSuggestion(e.target.value)} /></section>}
  </>;
}
