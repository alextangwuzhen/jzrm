import { describe, expect, it } from 'vitest';
import { splitImportedChapters } from '../src/importedChapters';
describe('导入作品章节',()=>{
  it('按章标题切分并保留前言',()=>{const rows=splitImportedChapters('前言\n第1章 开始\n甲\n第2章 变化\n乙');expect(rows.map(r=>r.title)).toEqual(['前言 / 未分章','第1章 开始','第2章 变化']);expect(rows[2].content).toContain('乙');});
  it('无章标题时提供全文',()=>expect(splitImportedChapters('一整篇文章')).toEqual([{id:'full',title:'全文',content:'一整篇文章'}]));
});
