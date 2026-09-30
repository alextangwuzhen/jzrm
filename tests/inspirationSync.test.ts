import {expect,it} from 'vitest';
import {createEntity,createInitialState,updateEntity,listEntities} from '../src/store';
import {syncInspiration} from '../src/inspirationSync';
it('keeps a work world setting synchronized with its inspiration source',()=>{
 let state=createEntity(createInitialState(),{id:'idea',kind:'inspiration',title:'金乌族',content:'金乌族已灭',workId:'work',category:'世界观'});
 state=syncInspiration(state,state.entities[0]);
 expect(listEntities(state,{kind:'setting',workId:'work',category:'world'})).toHaveLength(1);
 state=updateEntity(state,'idea',{content:'金乌族后人尚存'});
 state=syncInspiration(state,state.entities.find(e=>e.id==='idea')!);
 expect(listEntities(state,{kind:'setting',workId:'work',category:'world'})[0].content).toBe('金乌族后人尚存');
});
