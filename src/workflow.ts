export interface FlowNode { id: string; position: { x: number; y: number }; data: { label: string; route: string } }
export interface FlowEdge { id: string; source: string; target: string }
export interface CreativeFlow { nodes: FlowNode[]; edges: FlowEdge[] }

const steps = [
  ['灵感','/inspiration'],['小说大纲','/work/{workId}/outline'],['小说设定','/work/{workId}/settings'],
  ['小说细纲','/work/{workId}/fine-outline'],['小说创作','/work/{workId}/body'],['审校','/review'],
  ['改编剧本杀','/adaptation'],['再审校修改','/review']
];
export function defaultWorkflow(): CreativeFlow {
  return { nodes: steps.map(([label,route],i)=>({id:`step-${i}`,position:{x:80+(i%4)*270,y:80+Math.floor(i/4)*190},data:{label,route}})),edges:steps.slice(0,-1).map((_,i)=>({id:`edge-${i}`,source:`step-${i}`,target:`step-${i+1}`})) };
}
export function wouldCreateCycle(edges: FlowEdge[], source: string, target: string): boolean {
  if(source===target)return true;
  const visited=new Set<string>(); const stack=[target];
  while(stack.length){const node=stack.pop()!;if(node===source)return true;if(visited.has(node))continue;visited.add(node);for(const e of edges.filter(e=>e.source===node))stack.push(e.target);}
  return false;
}
export function nextWorkflowStep(flow: CreativeFlow, index: number): FlowNode | undefined {
  const node=flow.nodes[index]; if(!node)return undefined;
  const edge=flow.edges.find(e=>e.source===node.id);
  return flow.nodes.find(n=>n.id===edge?.target);
}
