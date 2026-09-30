import { describe, expect, it } from 'vitest';
import { alignmentIssues, buildRolePrompt, type TimelineEvent } from '../src/adaptation';

describe('小说改编剧本杀', () => {
  it('角色本提示只包含该角色已知的事实并使用第二人称', () => {
    const events: TimelineEvent[] = [
      { id:'1',time:'21:00',title:'到站',knowers:['林澈'],public:true },
      { id:'2',time:'20:30',title:'周岚进入档案室',knowers:['周岚'],public:false }
    ];
    const prompt=buildRolePrompt('林澈',events,'旧车站故事');
    expect(prompt).toContain('你');
    expect(prompt).toContain('到站');
    expect(prompt).not.toContain('周岚进入档案室');
  });

  it('同一事件时间冲突会被标出来', () => {
    const events: TimelineEvent[] = [
      { id:'a',time:'21:00',title:'玻璃碎裂',knowers:['林澈'],public:true },
      { id:'b',time:'21:20',title:'玻璃碎裂',knowers:['周岚'],public:true }
    ];
    expect(alignmentIssues(events)).toEqual(['“玻璃碎裂”存在不同现实时间：21:00、21:20']);
  });
});
