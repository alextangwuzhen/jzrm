import {expect,it} from 'vitest';
import {migrateTimelineTables} from '../src/migrations';
import {createInitialState,createEntity} from '../src/store';

it('keeps the source table and adds individual timeline events once',()=>{
 const state=createEntity(createInitialState(),{id:'source',kind:'setting',title:'事件时间线',category:'timeline',workId:'novel',content:'timeline（时间线）\n纪年\n事件\n饶帝30年\n大羿射杀金乌族\n羿帝21年\n天地审判'});
 const migrated=migrateTimelineTables(state);
 expect(migrated.entities.find(e=>e.id==='source')?.category).toBe('world');
 expect(migrated.entities.filter(e=>e.category==='timeline')).toHaveLength(2);
 expect(migrateTimelineTables(migrated).entities).toHaveLength(3);
});
