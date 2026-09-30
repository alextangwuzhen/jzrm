import { describe, expect, it } from 'vitest';
import { createEntity, createInitialState } from '../src/store';
import { migrateInvalidModelIds } from '../src/migrations';

describe('模型配置迁移',()=>{
  it('把已知错误的 DeepSeek 数字 ID 改成服务商支持的 ID，同时保留密钥引用 ID',()=>{
    let state=createEntity(createInitialState(),{id:'supplier',kind:'provider',title:'DeepSeek',meta:{role:'supplier'}});
    state=createEntity(state,{id:'model-key-id',kind:'provider',title:'1',parentId:'supplier',meta:{role:'model',model:'1'}});
    const next=migrateInvalidModelIds(state);
    expect(next.entities[1]).toMatchObject({id:'model-key-id',title:'deepseek-flash',meta:{model:'deepseek-flash'}});
  });
});
