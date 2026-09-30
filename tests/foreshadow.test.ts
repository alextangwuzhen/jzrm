import { describe, expect, it } from 'vitest';
import { readForeshadowStatus, detectForeshadowStatus, foreshadowCounts } from '../src/foreshadow';

describe('伏笔追踪', () => {
  it('缺失状态默认按埋设处理', () => {
    expect(readForeshadowStatus({})).toBe('埋设');
    expect(readForeshadowStatus({ status: '揭示' })).toBe('揭示');
    expect(readForeshadowStatus({ status: '未知' })).toBe('埋设');
  });

  it('按行内关键词识别埋设/揭示/废弃', () => {
    expect(detectForeshadowStatus('角色甲的真实身份')).toBe('埋设');
    expect(detectForeshadowStatus('此处揭示甲的动机')).toBe('揭示');
    expect(detectForeshadowStatus('该线废弃，不再回收')).toBe('废弃');
  });

  it('回收率只统计埋设与揭示，废弃不计入', () => {
    const counts = foreshadowCounts([
      { meta: { status: '埋设' } }, { meta: { status: '埋设' } }, { meta: { status: '揭示' } }, { meta: { status: '废弃' } }
    ]);
    expect(counts).toMatchObject({ planted: 2, revealed: 1, discarded: 1 });
    expect(counts.rate).toBe(33);
    expect(foreshadowCounts([]).rate).toBeNull();
  });
});
