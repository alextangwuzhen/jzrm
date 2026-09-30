import { describe, expect, it } from 'vitest';
import { createInitialState, createEntity } from '../src/store';
import { migrateSettingCards } from '../src/cardsMigration';
import { seedRestrictions } from '../src/restrictions';
import { illustratedDiagramSvg } from '../src/illustratedDiagram';
import { timelineSortKey } from '../src/TimelinePage';

describe('设定卡与限制仓库',()=>{
 it('把导入的角色和地点拆成可编辑小卡，重复启动不重建',()=>{
  let state=createInitialState();
  state=createEntity(state,{id:'work',kind:'work',title:'不谓侠'});
  state=createEntity(state,{id:'char',kind:'setting',title:'人物档案',category:'characters',workId:'work',content:'小师妹\n金乌后人\n小师弟\n嘴笨的小跟班'});
  state=createEntity(state,{id:'rel',kind:'setting',title:'人物关系',category:'characters',workId:'work',content:'CP 一：小师妹 × 小师弟'});
  state=createEntity(state,{id:'map',kind:'setting',title:'地点资料',category:'map',workId:'work',content:'地名\n出处\n北寒宫\n玉兔族聚集地\n四部九洲\n人间大陆'});
  const once=migrateSettingCards(state),twice=migrateSettingCards(once);
  expect(once.entities.filter(e=>e.meta.cardType==='character').map(e=>e.title)).toEqual(['小师妹','小师弟']);
  expect(once.entities.filter(e=>e.meta.cardType==='place').map(e=>e.title)).toEqual(['北寒宫','四部九洲']);
  expect(twice.entities.length).toBe(once.entities.length);
 });
 it('四类限制每类都有四条且可保留用户删除状态',()=>{
  const once=seedRestrictions(createInitialState());
  expect(once.entities.filter(e=>e.category==='restriction')).toHaveLength(16);
  expect(seedRestrictions(once).entities).toHaveLength(once.entities.length);
 });
 it('图片底图没有生成文字，标签由 SVG 本地叠加并转义',()=>{
  const svg=illustratedDiagramSvg('地图','data:image/png;base64,AA==',['北寒宫','A & B']);
  expect(svg).toContain('xlink:href="data:image/png;base64,AA=="');
  expect(svg).toContain('北寒宫');
  expect(svg).toContain('A &amp; B');
 });
 it('默认纪年排序把羿帝十四年放在饶帝三十六年之后',()=>{
  expect(timelineSortKey('饶帝30年')).toBeLessThan(timelineSortKey('饶帝36年'));
  expect(timelineSortKey('羿帝14年 初一傍晚')).toBeGreaterThan(timelineSortKey('饶帝36年'));
 });
});
