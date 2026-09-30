import { createEntity, type AppState } from './store';

export const restrictionTypes=['限制词','限制句式','限制语义','限制情景'] as const;
export const restrictionPresets:Record<string,string[]>={
  限制词:['不禁／不由自主：连续出现时显得动作反应模板化','仿佛／宛如：泛用比喻替代具体观察','一丝／一抹：抽象情绪或表情的万能量词','此时此刻／与此同时：机械过渡词'],
  限制句式:['不是 A，而是 B：反复对仗替读者下结论','他感到／她意识到……：直接告知情绪或领悟','眼中闪过一丝……：固定的表情描写槽位','三句同构排比：段落节奏过于工整'],
  限制语义:['命运齿轮开始转动：抽象宿命替代实际后果','这一刻终于明白：替角色和读者总结意义','所有人都会记住这一刻：无依据的宏大评价','这是最好的选择：旁白替人物作价值判断'],
  限制情景:['冲突后立刻长篇解释动机：破坏悬念与人物声线','每章结尾都用金句升华：弱化具体动作与留白','每场对话都让角色准确说出内心：缺少潜台词','环境描写只堆气味温度：与行动和情绪无关']
};
const sources=['https://github.com/worldwonderer/oh-story-claudecode/blob/9d0bd5f5aead707ddcdcf7d5f141b237e2ac464c/skills/story-deslop/references/anti-ai-writing.md','https://maliangwriter.com/blog/reduce-ai-detection-web-novel-guide/'];
export function seedRestrictions(state:AppState):AppState{
 let next=state;
 for(const [type,items] of Object.entries(restrictionPresets))for(let i=0;i<items.length;i++){
  const id=`preset:restriction:${type}:${i}`;
  if(next.entities.some(e=>e.id===id))continue;
  const [title,content]=items[i].split('：');
  next=createEntity(next,{id,kind:'memory',title,content,category:'restriction',meta:{restrictionType:type,builtIn:true,sourceLinks:sources}});
 }
 return next;
}
