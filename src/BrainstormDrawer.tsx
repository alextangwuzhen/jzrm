import { useState } from 'react';
import { Check, Plus, Send, Sparkles, Trash2, UsersRound, X } from 'lucide-react';
import { useApp } from './context';
import { listEntities, type Entity } from './store';
import { availableModels, modelFromProvider, pickModel, workContext } from './ai';
import { platform } from './platform';

type Turn={speaker:string;kind:'user'|'moderator'|'agent';round:number;text:string};
const suggestions=['下一章的核心冲突','角色动机是否可信','线索怎样自然投放','情绪高潮与反转','剧本杀角色视角分配'];
function readTurns(session?:Entity):Turn[]{return Array.isArray(session?.meta.turns)?session.meta.turns as Turn[]:[];}

export function BrainstormDrawer({onClose}:{onClose():void}) {
  const app=useApp();
  const sessions=listEntities(app.state,{kind:'chat'}).filter(e=>e.category==='脑暴').slice().reverse();
  const agents=listEntities(app.state,{kind:'agent'});
  const models=availableModels(app.state.entities);
  const skills=listEntities(app.state,{kind:'skill'});
  const styles=listEntities(app.state,{kind:'style'});
  const [selectedId,setSelectedId]=useState<string|null>(sessions[0]?.id??null);
  const [topic,setTopic]=useState('');
  const [message,setMessage]=useState('');
  const [seatIds,setSeatIds]=useState<string[]>(Array.isArray(sessions[0]?.meta.seats)?sessions[0].meta.seats as string[]:[]);
  const [rounds,setRounds]=useState(Number(sessions[0]?.meta.rounds??1));
  const [busy,setBusy]=useState(false);
  const current=sessions.find(s=>s.id===selectedId);
  const turns=readTurns(current);
  const select=(session:Entity)=>{setSelectedId(session.id);setTopic(String(session.meta.topic??''));setSeatIds(Array.isArray(session.meta.seats)?session.meta.seats as string[]:[]);setRounds(Number(session.meta.rounds??1));};
  const makeSession=()=>{
    const name=topic.trim();if(!name){app.notify('先填写议题');return;}
    const created=app.add('chat',`脑暴：${name}`,'',{workId:app.workId,category:'脑暴',meta:{topic:name,seats:seatIds,rounds,roundsCompleted:0,turns:[]}});
    setSelectedId(created.id);setMessage('');
  };
  const append=(session:Entity,next:Turn[],completed=Number(session.meta.roundsCompleted??0))=>app.update(session.id,{content:next.map(t=>`第 ${t.round} 轮 · ${t.speaker}\n${t.text}`).join('\n\n'),meta:{...session.meta,seats:seatIds,rounds,roundsCompleted:completed,turns:next}});
  const sendToHost=()=>{
    if(!current){app.notify('先创建一个议题聊天室');return;}
    const body=message.trim();if(!body)return;
    append(current,[...turns,{speaker:'你',kind:'user',round:Number(current.meta.roundsCompleted??0),text:body}]);
    setMessage('');
  };
  const toggleSeat=(id:string)=>setSeatIds(ids=>{const next=ids.includes(id)?ids.filter(x=>x!==id):ids.length<8?[...ids,id]:ids;if(current)app.update(current.id,{meta:{...current.meta,seats:next}});return next;});
  const runRounds=async(count:number,continuePrevious=false)=>{
    if(!current){app.notify('先创建议题聊天室');return;}
    if(seatIds.length<2){app.notify('至少选择两个参与讨论的 Agent');return;}
    setBusy(true);
    let transcript=[...turns];
    const host=agents.find(a=>a.category==='主管')??agents.find(a=>a.category==='DM');
    const hostProvider=models.find(m=>m.id===host?.meta.providerId)??pickModel(app.state.entities,'面宝');
    const initialRound=Number(current.meta.roundsCompleted??0);
    let completedRound=initialRound;
    const addTurn=(turn:Turn)=>{transcript=[...transcript,turn];append(current,transcript,completedRound);};
    try {
      for(let offset=1;offset<=count;offset++) {
        const round=initialRound+offset;
        const prior=transcript.filter(t=>t.round===round-1);
        addTurn({speaker:'主持',kind:'moderator',round,text:continuePrevious&&offset===1?`继续上一轮结论，进入第 ${round} 轮。请逐一回应未解决的问题。`:`第 ${round} 轮开始：${String(current.meta.topic??topic)}。请各位从自己的职责出发表达不同意见。`});
        for(const id of seatIds) {
          const agent=agents.find(a=>a.id===id);if(!agent)continue;
          const provider=models.find(m=>m.id===agent.meta.providerId)??pickModel(app.state.entities,'创作');
          const model=modelFromProvider(provider);if(!model)throw new Error(`${agent.title} 未配置可用模型`);
          const skill=skills.find(s=>s.id===agent.meta.skillId);
          const style=styles.find(s=>s.id===agent.meta.styleId);
          const text=await platform().runAi({...model,prompt:`你正在参加 JZRM 脑暴聊天室，担任 ${agent.title}（${agent.category}）。议题：${current.meta.topic}。\n职责与观点：${agent.content}\nSkill：${skill?.content??'无'}\n文风规则：${style?.content??'无'}\n作品事实：${workContext(app.state.entities,app.workId,app.state.preferences.contextLimit)}\n用户对主持的消息与前面发言：${transcript.slice(-14).map(t=>`${t.speaker}：${t.text}`).join('\n')}\n上一轮结果：${prior.map(t=>t.text).join('\n')}\n请以聊天室发言口吻提出自己的看法，可明确反对其他成员，并给出一条可执行建议。控制在 250 字以内。`});
          addTurn({speaker:agent.title,kind:'agent',round,text});
        }
        const moderatorModel=modelFromProvider(hostProvider);
        if(moderatorModel) {
          const summary=await platform().runAi({...moderatorModel,prompt:`你是脑暴主持。议题：${current.meta.topic}。整理第 ${round} 轮里各人分歧、共同点、待验证事项和下一轮最值得讨论的问题；不要把分歧抹平。\n${transcript.filter(t=>t.round===round).map(t=>`${t.speaker}：${t.text}`).join('\n')}`});
          addTurn({speaker:'主持',kind:'moderator',round,text:summary});
        }
        completedRound=round;
        append(current,transcript,completedRound);
      }
    } catch(e) { app.notify(String(e)); } finally { setBusy(false); }
  };
  const adopt=()=>{if(!current||!turns.length)return;app.add('inspiration',`脑暴结论：${current.meta.topic}`,turns.filter(t=>t.kind==='moderator').slice(-1).map(t=>t.text).join('\n')||current.content,{workId:app.workId,category:'剧情'});app.notify('已保存到灵感泡泡');};

  return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer brainstorm-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-heading"><span><UsersRound size={19}/><strong>脑暴聊天室</strong></span><button className="icon-button" onClick={onClose}><X size={18}/></button></div><div className="brainstorm-layout"><div className="brainstorm-sidebar"><h4>议题选择清单</h4>{suggestions.map(item=><button className="topic-suggestion" key={item} onClick={()=>setTopic(item)}>{item}</button>)}<label>新议题<input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="给主持一个具体议题"/></label><button className="button primary" onClick={makeSession}><Plus size={14}/>创建聊天室</button><div className="panel-heading"><h4>历史脑暴</h4><span>{sessions.length}</span></div><div className="brain-history">{sessions.map(session=><div className={`brain-history-row ${current?.id===session.id?'active':''}`} key={session.id}><button onClick={()=>select(session)}>{session.title}<small>{readTurns(session).length} 条发言</small></button><button title="移入垃圾箱" className="icon-button danger" onClick={()=>{app.trash(session.id);if(selectedId===session.id)setSelectedId(null);}}><Trash2 size={14}/></button></div>)}</div></div><div className="brainstorm-main">{current?<><div className="brain-topic"><div><span className="tiny-label">当前议题</span><h3>{String(current.meta.topic??current.title)}</h3></div><button className="button" onClick={adopt}>采纳结论</button></div><div className="brain-seat-row"><strong>参会 Agent</strong><div>{agents.map(agent=><button key={agent.id} className={seatIds.includes(agent.id)?'selected':''} onClick={()=>toggleSeat(agent.id)}>{seatIds.includes(agent.id)&&<Check size={12}/>} {agent.category} · {agent.title}</button>)}</div></div><div className="brain-round-actions"><label>讨论轮数<input type="number" min="1" max="5" value={rounds} onChange={e=>setRounds(Math.max(1,Math.min(5,Number(e.target.value)||1)))}/></label><button className="button primary" disabled={busy} onClick={()=>runRounds(rounds)}><Sparkles size={14}/>{busy?'讨论中…':`开始 ${rounds} 轮讨论`}</button><button className="button" disabled={busy||Number(current.meta.roundsCompleted??0)<1} onClick={()=>runRounds(1,true)}>基于本轮继续下一轮</button></div><div className="brain-chat-feed">{turns.map((turn,i)=><article className={`brain-chat-message ${turn.kind}`} key={i}><div><strong>{turn.speaker}</strong><small>第 {turn.round} 轮</small></div><p>{turn.text}</p></article>)}{!turns.length&&<div className="empty-small">向主持发送议题或补充意见，再开始讨论。</div>}</div><div className="brain-chat-compose"><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="向主持发送议题、补充事实，或直接加入讨论…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendToHost();}}}/><button className="button primary" onClick={sendToHost}><Send size={15}/>发送给主持</button></div></>:<div className="empty-state"><h3>选择历史脑暴，或创建新议题</h3><p>每位 Agent 会在聊天室独立发言，你可以随时补充意见。</p></div>}</div></div></aside></div>;
}
