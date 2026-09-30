import {expect,it} from 'vitest';
import {makeDiagramSvg,relationshipDiagramSvg,svgDataUrl} from '../src/diagram';
import type {Entity} from '../src/store';
const item=(title:string,content:string,meta:Record<string,unknown>={}):Entity=>({id:title,kind:'setting',title,content,workId:'w',category:'characters',meta,createdAt:'',updatedAt:''});
it('renders Chinese labels as SVG text and escapes source characters',()=>{
 const svg=makeDiagramSvg('不谓侠 · 人物关系网图',[item('人物档案','小师妹：想做女侠\n小师弟：她的跟班 <伙伴>')],'characters');
 expect(svg).toContain('小师妹');expect(svg).toContain('小师弟');expect(svg).toContain('<text');expect(svgDataUrl(svg)).toMatch(/^data:image\/svg\+xml/);
});
it('reads map place names from a structured imported table and orders dated events',()=>{
 const map=makeDiagramSvg('世界地图',[item('地点资料','地名\n出处\n北寒宫\n玉兔族聚集地在北寒蛮荒\n四部九洲\n每逢初一十五都需奉香火拜仙人')],'map');
 expect(map).toContain('北寒宫');expect(map).toContain('四部九洲');
 const timeline=makeDiagramSvg('时间轴',[item('后事','结束',{time:'羿帝21年'}),item('前事','开始',{time:'饶帝30年'})],'timeline');
 expect(timeline.indexOf('前事')).toBeLessThan(timeline.indexOf('后事'));
});
it('reads structured relations from character cards into edges',()=>{
 const svg=relationshipDiagramSvg('关系图',[
  item('小师妹','',{relations:[{target:'小师弟',relation:'同门',note:''}]}),
  item('小师弟','')
 ]);
 expect(svg).toContain('小师妹');expect(svg).toContain('小师弟');expect(svg).toContain('同门');
});
