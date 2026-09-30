import { describe, expect, it } from 'vitest';
import { createEntity, createInitialState, listEntities, moveToTrash, purgeEntity, restoreEntity, updateEntity } from '../src/store';

describe('作品数据与垃圾箱', () => {
  it('按作品隔离正文和设定', () => {
    let s = createInitialState();
    s = createEntity(s, { id: 'a', kind: 'work', title: '甲' });
    s = createEntity(s, { id: 'b', kind: 'work', title: '乙' });
    s = createEntity(s, { id: 'c1', kind: 'chapter', workId: 'a', title: '第一章', content: '甲的正文' });
    s = createEntity(s, { id: 'c2', kind: 'chapter', workId: 'b', title: '第一章', content: '乙的正文' });
    expect(listEntities(s, { kind: 'chapter', workId: 'a' }).map(e => e.content)).toEqual(['甲的正文']);
  });

  it('删除作品时一起移动章节，恢复作品时章节回到原位置', () => {
    let s = createInitialState();
    s = createEntity(s, { id: 'w', kind: 'work', title: '作品' });
    s = createEntity(s, { id: 'v', kind: 'volume', workId: 'w', parentId: 'w', title: '卷' });
    s = createEntity(s, { id: 'c', kind: 'chapter', workId: 'w', parentId: 'v', title: '章' });
    s = moveToTrash(s, 'w');
    expect(listEntities(s, { trash: true }).map(e => e.id)).toEqual(['w', 'v', 'c']);
    expect(listEntities(s, { kind: 'chapter', workId: 'w' })).toEqual([]);
    s = restoreEntity(s, 'w');
    expect(listEntities(s, { kind: 'chapter', workId: 'w' }).map(e => e.id)).toEqual(['c']);
  });

  it('分类查询垃圾箱，永久删除会清理子对象', () => {
    let s = createInitialState();
    s = createEntity(s, { id: 'w', kind: 'work', title: '作品' });
    s = createEntity(s, { id: 'c', kind: 'chapter', workId: 'w', parentId: 'w', title: '章' });
    s = moveToTrash(s, 'w');
    expect(listEntities(s, { trash: true, kind: 'chapter' }).map(e => e.id)).toEqual(['c']);
    expect(purgeEntity(s, 'w').entities).toEqual([]);
  });

  it('恢复同名节点需要先解决冲突', () => {
    let s = createInitialState();
    s = createEntity(s, { id: 'w', kind: 'work', title: '作品' });
    s = createEntity(s, { id: 'a', kind: 'chapter', workId: 'w', parentId: 'w', title: '第一章' });
    s = moveToTrash(s, 'a');
    s = createEntity(s, { id: 'b', kind: 'chapter', workId: 'w', parentId: 'w', title: '第一章' });
    expect(() => restoreEntity(s, 'a')).toThrow('RESTORE_CONFLICT');
    s = updateEntity(s, 'a', { title: '第一章（恢复）' });
    expect(listEntities(restoreEntity(s, 'a'), { kind: 'chapter', workId: 'w' })).toHaveLength(2);
  });
});
