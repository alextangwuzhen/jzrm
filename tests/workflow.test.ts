import { describe, expect, it } from 'vitest';
import { defaultWorkflow, nextWorkflowStep, wouldCreateCycle } from '../src/workflow';

describe('创作辅助流程', () => {
  it('预设八个创作阶段并指向真实功能页', () => {
    const nodes=defaultWorkflow().nodes;
    expect(nodes.map(n=>n.data.label)).toEqual(['灵感','小说大纲','小说设定','小说细纲','小说创作','审校','改编剧本杀','再审校修改']);
    expect(nodes.every(n=>String(n.data.route).startsWith('/'))).toBe(true);
  });
  it('拒绝产生回路的连线', () => {
    const flow=defaultWorkflow();
    expect(wouldCreateCycle(flow.edges,'step-7','step-0')).toBe(true);
    expect(nextWorkflowStep(flow,0)?.data.label).toBe('小说大纲');
  });
});
