import { createEntity, type AppState } from './store';

type SkillPreset={id:string;title:string;category:string;summary:string;steps:string;source:string};
const story='https://github.com/danjdewhurst/story-skills/blob/main/skills/';
const presets:SkillPreset[]=[
{id:'premise',title:'故事命题打磨',category:'策划',summary:'检验一句话灵感能否支撑长篇。',steps:'提取主角、欲望、阻力、代价和反命题。给出三种故事前提；逐一说明可延展的冲突和薄弱环节。只保留能推动角色选择的设定。',source:story+'premise-workshop/SKILL.md'},
{id:'character',title:'角色弧光与关系',category:'角色',summary:'把人物欲望、弱点与关系变化串成行动。',steps:'为每个角色列外部目标、内部需求、错误信念、秘密、可见习惯和关系转折。核对变化是否由事件触发，避免标签式性格。',source:story+'character-management/SKILL.md'},
{id:'world',title:'世界规则核对',category:'设定',summary:'让背景规则参与冲突，而不只作装饰。',steps:'列出地点、制度、资源、限制和历史。把每条规则连到社会后果、人物处境和剧情问题。标记例外及代价，避免便利性破例。',source:story+'worldbuilding/SKILL.md'},
{id:'plot',title:'长篇情节结构',category:'策划',summary:'维护阶段目标、转折和结局兑现。',steps:'从结局需要的人物变化倒推关键选择。每个阶段设目标、阻力、失去、转折与新问题。检查因果链和重复桥段。',source:story+'plot-structure/SKILL.md'},
{id:'chapter',title:'逐章创作',category:'写作',summary:'先列场景目标再写正文。',steps:'读取前章结尾、人物状态、世界规则和未回收伏笔。为本章列视角、地点、目标、冲突、转折。正文只写当前章节，结尾更新状态。',source:story+'chapter-writing/SKILL.md'},
{id:'scene',title:'场景与对白',category:'写作',summary:'用行动、潜台词和环境塑造现场感。',steps:'每场景确定进入状态和离开状态，至少一件事发生改变。让每人对话目标不同，以动作打断说明性对白；感官细节应影响选择。',source:story+'scene-craft/SKILL.md'},
{id:'voice',title:'人物声线与文风',category:'文风',summary:'区分人物用词、节奏和禁用表达。',steps:'建立作者文风表与角色声线表，记录句长、常用词、避用词和对话习惯。逐段检查偏移，提出最小改动。',source:story+'voice-style/SKILL.md'},
{id:'continuity',title:'连续性与伏笔审校',category:'审校',summary:'核对时间、知情、道具和伏笔回收。',steps:'建立事件时间线、角色知情表、道具状态表和线索投放表。逐章指出原文证据、冲突原因和修复方案；不要凭空补事实。',source:story+'revision-continuity/SKILL.md'},
{id:'reader',title:'模拟读者反馈',category:'读者',summary:'从不同读者身份指出体验问题。',steps:'分别以目标类型读者、首次阅读者、连续性读者三个视角阅读。记录被吸引处、卡顿处、误解处及原文位置；分歧单独保留。',source:story+'reader-panel/SKILL.md'},
{id:'script',title:'剧本场景与主持说明',category:'剧本杀',summary:'把故事节点转为可演绎的场景和主持条件。',steps:'确定场景进入条件、角色目标、可见行动、关键对白和结束状态。玩家文本保持第二人称；主持页写触发条件、线索投放与异常分支。',source:story+'adaptation/SKILL.md'}
];
export const skillPresets=presets;
export function seedSkills(state:AppState):AppState {let next=state;for(const p of presets){const id=`preset:skill:${p.id}`;if(next.entities.some(e=>e.id===id))continue;next=createEntity(next,{id,kind:'skill',title:p.title,content:p.steps,category:p.category,meta:{summary:p.summary,source:p.source,builtIn:true,loadedForMianbao:['premise','character','world','plot'].includes(p.id)}});}return next;}
