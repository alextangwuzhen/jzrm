import {it,expect} from 'vitest';
import {parseSettingDocument} from '../src/settingImport';
it('splits labeled source material into work sections',()=>{
 const result=parseSettingDocument('brief（作品简介）\n简介\ncharacters（人物）\n主角\nrules（硬约束 / 限制词）\n禁忌');
 expect(result.map(x=>x.category)).toEqual(['总纲','characters','facts']);
 expect(result[1].content).toContain('主角');
});
it('turns dated timeline rows into events with organizer-only visibility',()=>{
 const result=parseSettingDocument('timeline（时间线）\n纪年\n事件\n饶帝30年\n大羿射杀金乌族\n羿帝21年\n天地审判\n换算：待核对\nemotion（情绪线）\n悲喜');
 expect(result.filter(x=>x.category==='timeline')).toMatchObject([
  {title:'大羿射杀金乌族',meta:{time:'饶帝30年',knowers:['组织者']}},
  {title:'天地审判',meta:{time:'羿帝21年',knowers:['组织者']}}
 ]);
});
it('recognizes Chinese headings and inline dated events in an imported inspiration document',()=>{
 const result=parseSettingDocument('创作灵感\n故事\n角色灵感\n小师妹：想做女侠\n世界规则：\n仙族依赖香火\n时间线：\n饶帝30年，大羿射杀金乌族。\n设定补足\n北寒宫');
 expect(result.map(x=>x.category)).toEqual(['总纲','characters','world','timeline','world']);
 expect(result[3]).toMatchObject({title:'大羿射杀金乌族。',meta:{time:'饶帝30年'}});
});
