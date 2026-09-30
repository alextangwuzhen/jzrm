import {expect,it} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {isNovelSource,rankedBooks}=require('../electron/web.cjs');
it('accepts only the configured netnovel platforms',()=>{
 expect(isNovelSource({url:'https://www.qidian.com/rank/yuepiao/'})).toBe(true);
 expect(isNovelSource({url:'https://www.qimao.com/paihang'})).toBe(true);
 expect(isNovelSource({url:'https://news.example.com/article'})).toBe(false);
 expect(isNovelSource({url:'https://qidian.com.evil.example/article'})).toBe(false);
});
it('extracts ranked book names from platform pages without using news links',()=>{
 const qidian='*   1[![Image 11: 夜无疆在线阅读](cover)](https://www.qidian.com/book/1040765595/) ## [夜无疆](https://www.qidian.com/book/1040765595/ "夜无疆")';
 const qimao='*   [![Image 5](cover)1](https://www.qimao.com/shuku/195958/) [盖世神医](https://www.qimao.com/shuku/195958/)';
 expect(rankedBooks(qidian,'https://www.qidian.com/rank/yuepiao/')[0].name).toBe('夜无疆');
 expect(rankedBooks(qimao,'https://www.qimao.com/paihang/boy/hot/date/')[0].name).toBe('盖世神医');
});
