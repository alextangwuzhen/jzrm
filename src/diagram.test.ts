import { describe, expect, it } from 'vitest';
import { makeDiagramSvg } from './diagram';
import type { Entity } from './store';

const item=(title:string,content:string):Entity=>({id:title,kind:'setting',title,content,meta:{},createdAt:'',updatedAt:''});

describe('人物关系图',()=>{
  it('只提取关系表里的角色，不把表头和参考人物画成角色',()=>{
    const svg=makeDiagramSvg('关系图',[
      item('人物档案','称谓\n设定\n小师妹\n她要下山。\n唐钰小宝\n作者原意：请补情绪。'),
      item('人物关系','CP 一：小师妹 × 小师弟\n父女：爹爹 — 小师妹\n旧情：大羿 — 前玉兔族公主\n父女：人皇大羿 — 小师妹'),
    ],'characters');
    expect(svg).toContain('小师妹');
    expect(svg).toContain('小师弟');
    expect(svg).toContain('爹爹');
    expect(svg).not.toContain('唐钰小宝');
    expect(svg).not.toContain('作者原意');
    expect((svg.match(/>大羿</g)||[]).length).toBe(0);
    expect(svg).toContain('人皇大羿');
  });
});
