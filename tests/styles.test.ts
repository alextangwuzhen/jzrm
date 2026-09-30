import { describe, expect, it } from 'vitest';
import { seedStyles } from '../src/styles';
import { createInitialState, listEntities } from '../src/store';

describe('文风仓库预设', () => {
  it('提供六个可编辑的预设文风包', () => {
    const styles=listEntities(seedStyles(createInitialState()),{kind:'style'});
    expect(styles).toHaveLength(6);
    expect(styles.every(style=>style.content && style.meta.example)).toBe(true);
  });
});
