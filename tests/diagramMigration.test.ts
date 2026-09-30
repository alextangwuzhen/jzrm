import {expect,it} from 'vitest';
import {createEntity,createInitialState} from '../src/store';
import {migrateLegacyDiagrams} from '../src/diagramMigration';
it('replaces garbled model image with a label-safe SVG from setting facts',()=>{
 let s=createInitialState();
 s=createEntity(s,{id:'work',kind:'work',title:'不谓侠'});
 s=createEntity(s,{id:'fact',kind:'setting',title:'小师妹',content:'金乌后人',workId:'work',category:'characters'});
 s=createEntity(s,{id:'image',kind:'setting',title:'人物关系网图',workId:'work',category:'characters',meta:{imageData:'data:image/png;base64,old',diagramType:'人物关系网图'}});
 const out=migrateLegacyDiagrams(s);const image=out.entities.find(e=>e.id==='image')!;
 expect(image.meta.imageFormat).toBe('svg');expect(String(image.meta.imageData)).toContain('data:image/svg+xml');
});
