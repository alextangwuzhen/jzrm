import { useState } from 'react';
import { useApp } from './context';
import { availableModels } from './ai';
import { AiModelsPanel } from './AiModelsPanel';
import { PromptTemplatesPanel } from './PromptTemplatesPanel';
import { MianbaoPanel } from './MianbaoPanel';
import { platform } from './platform';

const tabs=['API 接入','生图模型','面宝','Prompt 模板','AI 用量'];
export function AiConfigPage(){const [tab,setTab]=useState(tabs[0]);return <><div className="page-intro"><div><span className="eyebrow">AI WORKSPACE</span><h2>AI 配置中心</h2><p>供应商、模型、智能体、面宝规则和 Prompt 模板分别管理。</p></div></div><div className="category-tabs">{tabs.map(name=><button key={name} className={tab===name?'selected':''} onClick={()=>setTab(name)}>{name}</button>)}</div>{tab==='API 接入'&&<AiModelsPanel purpose="text"/>}{tab==='生图模型'&&<AiModelsPanel purpose="image"/>}{tab==='面宝'&&<MianbaoPanel/>}{tab==='Prompt 模板'&&<PromptTemplatesPanel/>}{tab==='AI 用量'&&<UsagePanel/>}</>;}
function UsagePanel(){const app=useApp();const [usage,setUsage]=useState<Array<{model:string;providerId:string;input:number;output:number;at:string}>>([]);const models=[...availableModels(app.state.entities),...availableModels(app.state.entities,'image')];const refresh=async()=>{try{setUsage(await platform().usage());}catch(e){app.notify(String(e));}};const total=usage.reduce((n,u)=>n+u.input+u.output,0);return <section className="paper-page"><div className="panel-heading"><h3>AI 用量</h3><button className="button" onClick={refresh}>刷新记录</button></div><div className="stat-mini"><span>总 Token {total.toLocaleString()}</span><span>调用次数 {usage.length}</span><span>已配置模型 {models.length}</span></div><p className="muted">费用依供应商定价变化，这里只展示实际返回的 Token 用量。</p><div className="trash-list">{usage.slice().reverse().map((entry,i)=><div className="trash-row" key={i}><div><strong>{entry.model}</strong><small>{entry.at}</small></div><span>输入 {entry.input} · 输出 {entry.output}</span></div>)}</div></section>;}
