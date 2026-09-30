import { useMemo } from 'react';
import { Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { X } from 'lucide-react';
import { relationshipData } from './diagram';
import type { Entity } from './store';
import '@xyflow/react/dist/style.css';

function PersonNode({ data }: NodeProps) {
  return <div className="person-node" title={String(data.label)}>{String(data.label)}</div>;
}
const nodeTypes = { person: PersonNode };

function buildNodes(nodes: Array<{ id: string; title: string }>): Node[] {
  const cols = Math.ceil(Math.sqrt(Math.max(1, nodes.length)));
  return nodes.map((n, i) => ({
    id: n.id,
    type: 'person',
    position: { x: 60 + (i % cols) * 240, y: 60 + Math.floor(i / cols) * 120 },
    data: { label: n.title }
  }));
}

function buildEdges(edges: Array<{ source: string; target: string; label: string }>): Edge[] {
  return edges.map((e, i) => ({ id: `rel-${i}`, source: e.source, target: e.target, label: e.label, type: 'smoothstep', animated: true }));
}

export function RelationshipCanvas({ work, items, onClose }: { work: Entity; items: Entity[]; onClose(): void }) {
  const data = useMemo(() => relationshipData(items), [items]);
  const initialNodes = useMemo(() => buildNodes(data.nodes), [data]);
  const initialEdges = useMemo(() => buildEdges(data.edges), [data]);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  return <div className="canvas-backdrop" onClick={onClose}>
    <div className="canvas-panel" onClick={e => e.stopPropagation()}>
      <div className="canvas-head"><div><span className="eyebrow">RELATIONSHIP CANVAS</span><h3>{work.title} · 人物关系画布</h3></div><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={20} /></button></div>
      <p className="canvas-hint">拖拽节点调整位置 · 滚轮缩放 · 拖动空白平移 · 连线来自关系资料与角色档案中的人际关系</p>
      <div className="canvas-body">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView deleteKeyCode={null} nodesConnectable={false} elementsSelectable>
          <Background color="#ddd5ca" gap={20} />
          <Controls />
          <MiniMap nodeColor="#c07b6f" maskColor="#00000012" />
        </ReactFlow>
      </div>
    </div>
  </div>;
}
