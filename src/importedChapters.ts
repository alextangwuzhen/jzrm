export type ImportedChapter={id:string;title:string;content:string};
const heading=/^(?:第[一二三四五六七八九十百千万零〇两0-9]+[章节回幕](?:[^\n]{0,60})?|Chapter\s+\d+(?:[^\n]{0,60})?)$/gim;
export function splitImportedChapters(text:string):ImportedChapter[]{
  const matches=[...text.matchAll(heading)];
  if(!matches.length)return [{id:'full',title:'全文',content:text}];
  const sections:ImportedChapter[]=[];
  if((matches[0].index??0)>0&&text.slice(0,matches[0].index).trim())sections.push({id:'preface',title:'前言 / 未分章',content:text.slice(0,matches[0].index).trim()});
  matches.forEach((match,i)=>{const begin=match.index??0;const end=i+1<matches.length?matches[i+1].index??text.length:text.length;sections.push({id:`part:${i}`,title:match[0].trim(),content:text.slice(begin,end).trim()});});
  return sections;
}
