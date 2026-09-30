import { useCallback, useEffect, useState } from 'react';
import { addEdge, Background, Controls, Handle, MiniMap, Position, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { Check, Plus, Trash2, Workflow } from 'lucide-react';
import { useApp } from './context';
import { listEntities } from './store';
import { defaultWorkflow, wouldCreateCycle, type CreativeFlow } from './workflow';
import '@xyflow/react/dist/style.css';

function StepNode({ data, selected }: NodeProps) {
  return <div className={`flow-node ${selected?'selected':''}`}><Handle type="target" position={Position.Left}/><span>CREATIVE STEP</span><strong>{String(data.label)}</strong><small>{String(data.route)}</small><Handle type="source" position={Position.Right}/></div>;
}
const nodeTypes={step:StepNode};
const toNodes=(flow:CreativeFlow):Node[]=>flow.nodes.map(n=>({...n,type:'step'}));
const toEdges=(flow:CreativeFlow):Edge[]=>flow.edges.map(e=>({...e,type:'smoothstep',animated:true}));

export function WorkflowPage() {
  const app=useApp(); const flows=listEntities(app.state,{kind:'workflow'}); const [flowId,setFlowId]=useState(flows[0]?.id??''); const entity=flows.find(f=>f.id===flowId)??flows[0];
  const [nodes,setNodes,onNodesChange]=useNodesState<Node>([]); const [edges,setEdges,onEdgesChange]=useEdgesState<Edge>([]);
  const [selected,setSelected]=useState<string|null>(null); const [loadedId,setLoadedId]=useState(''); const [module,setModule]=useState('小说创作');
  useEffect(()=>{if(!entity){setNodes([]);setEdges([]);setLoadedId('');return;}const f=entity.meta.flow as CreativeFlow|undefined;const flow=f??defaultWorkflow();setNodes(toNodes(flow));setEdges(toEdges(flow));setLoadedId(entity.id);},[entity?.id]);
  useEffect(()=>{if(!entity||loadedId!==entity.id)return;const timer=window.setTimeout(()=>app.update(entity.id,{meta:{...entity.meta,flow:{nodes:nodes.map(n=>({id:n.id,position:n.position,data:{label:String(n.data.label),route:String(n.data.route)}})),edges:edges.map(e=>({id:e.id,source:e.source,target:e.target}))}}}),600);return()=>clearTimeout(timer);},[nodes,edges,loadedId]);
  const onConnect=useCallback((connection:Connection)=>{if(!connection.source||!connection.target)return;if(wouldCreateCycle(edges.map(e=>({id:e.id,source:e.source,target:e.target})),connection.source,connection.target)){app.notify('流程不能形成回路');return;}setEdges(es=>addEdge({...connection,type:'smoothstep',animated:true},es));},[edges]);
  const createDefault=()=>{const flow=app.add('workflow','默认小说与剧本杀创作流程','',{meta:{flow:defaultWorkflow(),currentStep:0}});setFlowId(flow.id);};
  const addNode=()=>{const labels:Record<string,string>={'灵感':'/inspiration','小说大纲':'/work/{workId}/outline','小说设定':'/work/{workId}/settings','小说细纲':'/work/{workId}/fine-outline','小说创作':'/work/{workId}/body','审校':'/review','改编剧本杀':'/adaptation','AI 润笔':'/polish','作品拆解':'/split'};const id=crypto.randomUUID();setNodes(ns=>[...ns,{id,type:'step',position:{x:100+(ns.length%4)*240,y:120+Math.floor(ns.length/4)*180},data:{label:module,route:labels[module]??'/'}}]);setSelected(id);};
  const selectedNode=nodes.find(n=>n.id===selected);
  const deleteSelected=()=>{if(!selected)return;setNodes(ns=>ns.filter(n=>n.id!==selected));setEdges(es=>es.filter(e=>e.source!==selected&&e.target!==selected));setSelected(null);};
  const openStep=(node:Node)=>{const route=String(node.data.route).replace('{workId}',app.workId??'');if(route.includes('/work//')){app.notify('请先选择作品');return;}app.navigate(route);};
  return <><div className="page-intro"><div><span className="eyebrow">WORKFLOW / CREATIVE GUIDANCE</span><h2>创作辅助流程</h2><p>拖动节点、拖线建立依赖，完成配置后可按步骤跳到对应页面。</p></div><div className="action-row"><select value={flowId} onChange={e=>setFlowId(e.target.value)}><option value="">选择流程</option>{flows.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select><button className="button primary" onClick={createDefault}><Workflow size={16}/>一键配置预设</button></div></div>{entity?<div className="workflow-layout"><aside className="workflow-palette"><h3>节点库</h3><p>选择模块，添加到画布后拖动定位。</p><select value={module} onChange={e=>setModule(e.target.value)}>{['灵感','小说大纲','小说设定','小说细纲','小说创作','审校','改编剧本杀','AI 润笔','作品拆解'].map(x=><option key={x}>{x}</option>)}</select><button className="button" onClick={addNode}><Plus size={15}/>添加节点</button><hr/><strong>当前节点</strong>{selectedNode?<><label>标题<input value={String(selectedNode.data.label)} onChange={e=>setNodes(ns=>ns.map(n=>n.id===selected?{...n,data:{...n.data,label:e.target.value}}:n))}/></label><label>目标页面<input value={String(selectedNode.data.route)} onChange={e=>setNodes(ns=>ns.map(n=>n.id===selected?{...n,data:{...n.data,route:e.target.value}}:n))}/></label><button className="button" onClick={()=>openStep(selectedNode)}><Check size={15}/>进入此步骤</button><button className="button danger" onClick={deleteSelected}><Trash2 size={15}/>删除节点</button></>:<p className="muted">点击画布中的节点编辑，双击进入页面。</p>}<hr/><button className="button danger" onClick={()=>app.trash(entity.id)}><Trash2 size={15}/>删除流程</button></aside><div className="workflow-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_,node)=>setSelected(node.id)} onNodeDoubleClick={(_,node)=>openStep(node)} fitView deleteKeyCode="Backspace"><Background color="#d8d0c5" gap={20}/><Controls/><MiniMap/></ReactFlow></div></div>:<div className="empty-state"><Workflow size={32}/><h3>创建第一个创作流程</h3><p>预设：灵感 → 大纲 → 设定 → 细纲 → 正文 → 审校 → 改编 → 再审校。</p><button className="button primary" onClick={createDefault}>一键配置</button></div>}</>;
}
