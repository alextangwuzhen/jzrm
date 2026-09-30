export type ImportedSetting={kind:'setting'|'memory'|'outline';category:string;title:string;content:string;meta?:Record<string,unknown>};
const sections:[RegExp,ImportedSetting['kind'],string,string][]=[
 [/^brief（作品简介）$/m,'outline','总纲','作品简介'],
 [/^characters（人物）$/m,'setting','characters','人物档案'],
 [/^relations（关系）$/m,'setting','characters','人物关系'],
 [/^places（地点）$/m,'setting','map','地点资料'],
 [/^facts（世界规则 \/ 设定事实）$/m,'setting','world','世界规则与事实'],
 [/^timeline（时间线）$/m,'setting','timeline','事件时间线'],
 [/^emotion（情绪线）$/m,'setting','emotion','情绪线'],
 [/^routes（卷次结构）$/m,'outline','卷纲','卷次结构'],
 [/^styles（文风卡）$/m,'setting','style','文风卡'],
 [/^rules（硬约束 \/ 限制词）$/m,'memory','facts','创作硬约束']
];
const chineseSections:[RegExp,ImportedSetting['kind'],string,string][]=[
 [/^创作灵感\s*$/m,'outline','总纲','创作灵感'],
 [/^主题思想\s*$/m,'outline','总纲','主题思想'],
 [/^角色灵感\s*$/m,'setting','characters','人物档案'],
 [/^写法介绍\s*$/m,'setting','style','文风写法'],
 [/^世界规则[：:]?\s*$/m,'setting','world','世界规则与事实'],
 [/^时间线[：:]?\s*$/m,'setting','timeline','事件时间线'],
 [/^设定补足\s*$/m,'setting','world','设定补足'],
 [/^内容灵感碎片[：:]?\s*$/m,'outline','总纲','内容灵感碎片'],
 [/^《[^》]+》文风卡[^\n]*$/m,'setting','style','作品文风卡']
];
export function parseSettingDocument(text:string):ImportedSetting[]{
 const english=sections.map(([pattern,kind,category,title])=>({index:pattern.exec(text)?.index??-1,kind,category,title})).filter(x=>x.index>=0);
 const found=(english.length?english:chineseSections.map(([pattern,kind,category,title])=>({index:pattern.exec(text)?.index??-1,kind,category,title})).filter(x=>x.index>=0)).sort((a,b)=>a.index-b.index);
 if(!found.length)return [{kind:'setting',category:'world',title:'导入设定原文',content:text}];
 return found.flatMap((item,i)=>{
  const content=text.slice(item.index,found[i+1]?.index??text.length).trim();
  if(item.category!=='timeline')return [{kind:item.kind,category:item.category,title:item.title,content}];
  const lines=content.split(/\n+/).map(line=>line.trim()).filter(Boolean);
  const events:ImportedSetting[]=[];
  for(let n=0;n<lines.length;n++){
   const date=lines[n].match(/^((?:饶帝|羿帝)\d+年(?:（[^）]+）)?)[，,、\s]*(.*)$/);
   if(!date)continue;
   const description=date[2]||lines[n+1];
   if(!description||/^(?:饶帝|羿帝)\d+年/.test(description)||description.startsWith('换算：'))continue;
   events.push({kind:'setting',category:'timeline',title:description.slice(0,28),content:description,meta:{time:date[1],knowers:['组织者'],public:false,memory:false}});
  }
  return events.length?events:[{kind:item.kind,category:item.category,title:item.title,content}];
 });
}
