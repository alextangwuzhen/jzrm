import { createEntity, type AppState } from './store';

type Preset={id:string;title:string;category:string;system:string;body:string;source?:string};
const reviewSystem='你是一位资深小说编辑。依据实际文本和已提供设定，逐项给出原文证据与可执行修改建议；材料不足时说明缺口。';
export const promptPresets:Preset[]=[
{id:'foreshadow',title:'伏笔检测',category:'分析工具',system:'你是一位细致的小说编辑。检查伏笔的埋设、回收和因果公平性。',body:'【已知伏笔】\n{foreshadowings}\n【待检测章节】\n{chapter_content}\n【前文摘要】\n{prev_summary}\n列出新伏笔、已回收伏笔和有证据的问题。'},
{id:'chapter-summary',title:'章节摘要生成',category:'分析工具',system:'你是一位精准的文字摘要编辑。保留关键事件、人物行动和重要信息。',body:'【章节标题】{chapter_title}\n【章节内容】\n{chapter_content}\n生成200字以内的章节摘要，写明事件、行动、关键对话和推进。'},
{id:'analysis',title:'分析',category:'创作辅助',system:reviewSystem,body:'【世界观规则】{world_rules}\n【角色设定】{characters}\n【前文摘要】{prev_summary}\n【待分析文本】{chapter_content}\n从一致性、逻辑、人物、节奏、语言和AI痕迹六方面分析，给出原文证据。'},
{id:'humanize',title:'去AI',category:'创作辅助',system:'你是一位小说编辑。保留事实与人物声线，删去僵硬套话、空洞形容词和机械总结。',body:'请改写以下文本，只输出改后正文：\n{text}'},
{id:'scene',title:'场景描写增强',category:'创作辅助',system:'你擅长用服务于行动的感官细节增强场景，不堆砌形容词。',body:'【当前场景】{text}\n【场景氛围】{mood}\n【视角角色】{pov}\n增强场景描写，保留原有信息。'},
{id:'outline',title:'大纲生成',category:'创作辅助',system:'你是一位小说架构师。用因果与人物选择组织大纲。',body:'【类型】{genre}\n【世界观】{world_setting}\n【主角】{protagonist}\n【核心冲突】{core_conflict}\n【目标字数】{target_words}\n生成起承转合大纲，每幕列出关键节点。'},
{id:'dialogue',title:'对话生成',category:'创作辅助',system:'你擅长写符合角色声线、有潜台词且推进关系的对话。',body:'【角色A】{char_a_name}：{char_a_personality}；口癖：{char_a_speech}\n【角色B】{char_b_name}：{char_b_personality}；口癖：{char_b_speech}\n【场景】{scene}\n【目的】{purpose}\n写出这段对话。'},
{id:'polish',title:'润色',category:'创作辅助',system:'你是一位小说编辑。保留原意、情节和人物动作，改进句式并去除冗余。',body:'润色以下文本，只输出修改后的正文：\n{text}'},
{id:'ideas',title:'灵感激发',category:'创作辅助',system:'你是一位小说策划。建议必须出人意料且能由已知信息支持。',body:'【当前设定】{settings}\n【当前情节】{current_plot}\n提出三个有代价的后续走向。'},
{id:'continue',title:'续写',category:'创作辅助',system:'你是一位小说创作者。保持文风、视角、设定和人物知情边界。',body:'【世界观】{world_setting}\n【角色】{characters}\n【前文】{context}\n【当前章节】{current_content}\n续写约{word_count}字，不重复原文。'},
{id:'monologue',title:'角色心理独白',category:'创作辅助',system:'你擅长通过矛盾动机和具体感受呈现人物心理。',body:'【角色】{char_name}\n【性格】{char_personality}\n【背景】{char_background}\n【情境】{situation}\n【情绪】{emotion}\n写300至500字内心独白。'},
{id:'style-check',title:'文风一致性检查',category:'评审检查',system:'你是一位关注声线和句法的编辑。只根据参考样本指出偏差。',body:'【参考文风】{style_samples}\n【文风参数】{style_params}\n【待检查文本】{text}\n给出一致性判断、原文证据和建议。'},
{id:'chapter-review',title:'章节评审',category:'评审检查',system:reviewSystem,body:'【世界观】{world_rules}\n【角色】{characters}\n【前文摘要】{prev_summary}\n【章节】{chapter_content}\n从连续性、逻辑、人物、节奏、语言和AI痕迹评审，证据必须来自原文。'},
{id:'female-long',title:'中长篇女频网文创作',category:'创作辅助',system:'你是中长篇女频小说策划与写手。以主角目标、关系张力和持续成长组织章节，尊重人物主体性，情绪必须由选择与后果产生。',body:'【题材】{genre}\n【读者期待】{reader_promise}\n【女主目标与边界】{protagonist}\n【关系网】{relationships}\n【当前大纲】{outline}\n【前文与伏笔】{context}\n【本章目标】{chapter_goal}\n写约{word_count}字。每场景含目标、阻力、转折；避免重复误会拖延和空泛感叹。',source:'https://github.com/danjdewhurst/story-skills/blob/main/skills/genre-craft/SKILL.md'},
{id:'murder-emotion',title:'情感本创作',category:'创作辅助',system:'你是情感本主策。先设计关系裂痕、未说出口的选择及其代价；玩家可以在演绎中改变关系，但既定事实不因玩家选择而漂移。',body:'【人数与时长】{players_duration}\n【故事核心】{premise}\n【人物关系】{characters}\n【现实时间线】{timeline}\n【情感目标】{emotion_goal}\n【当前幕】{act}\n逐角色给出第二人称文本、演绎目标、关系冲突和可以选择的表达；再给主持人触发条件、放本顺序与情绪兜底。',source:'https://github.com/danjdewhurst/story-skills/blob/main/skills/adaptation/SKILL.md'},
{id:'murder-mechanism',title:'机制欢乐本创作',category:'创作辅助',system:'你是机制欢乐本主策。规则要能现场执行，互动要产生角色关系与剧情后果；笑点来自人物碰撞，不依赖羞辱玩家。',body:'【人数与时长】{players_duration}\n【故事核心】{premise}\n【角色目标】{characters}\n【可用道具】{props}\n【当前幕】{act}\n设计可复盘的机制、轮次、计分与失败兜底。写第二人称玩家指引和主持人流程，说明每个机制如何推动剧情。',source:'https://github.com/danjdewhurst/story-skills/blob/main/skills/scene-craft/SKILL.md'},
{id:'murder-deduction',title:'推理本创作',category:'创作辅助',system:'你是推理本主策。真相线、角色知情线和线索投放线必须一致；每个关键结论都要能由已投放证据推导。',body:'【人数与时长】{players_duration}\n【案件与真相】{premise}\n【角色秘密】{characters}\n【现实时间线】{timeline}\n【线索清单】{clues}\n【当前幕】{act}\n写第二人称玩家文本、线索卡、可推导链、红鲱鱼回收和主持人复盘。逐条检查线索可获得时间与知情边界。',source:'https://github.com/danjdewhurst/story-skills/blob/main/skills/genre-craft/SKILL.md'},
{id:'male-long',title:'中长篇男频网文创作',category:'创作辅助',system:'你是中长篇男频小说策划与写手。用可持续的目标链、能力代价和因果兑现组织成长；每次胜利引出新的选择。',body:'【题材】{genre}\n【核心爽点】{reader_promise}\n【主角目标与能力代价】{protagonist}\n【世界规则】{world_setting}\n【阶段大纲】{outline}\n【前文与伏笔】{context}\n【本章目标】{chapter_goal}\n写约{word_count}字。行动有阻力和代价，结尾留下具体未决问题，避免无规则开挂与设定灌输。',source:'https://github.com/danjdewhurst/story-skills/blob/main/skills/plot-structure/SKILL.md'}
];
export function seedPrompts(state:AppState):AppState {let next=state;for(const p of promptPresets){const id=`preset:prompt:${p.id}`;if(next.entities.some(e=>e.id===id))continue;next=createEntity(next,{id,kind:'prompt',title:p.title,content:p.body,category:p.category,meta:{systemPrompt:p.system,source:p.source??'StarWriter 页面逻辑参考',builtIn:true}});}return next;}
export function promptVariables(body:string):string[]{return [...new Set([...body.matchAll(/\{([a-zA-Z_][\w]*)\}/g)].map(m=>m[1]))];}
export function renderPrompt(body:string,values:Record<string,string>):string{return body.replace(/\{([a-zA-Z_][\w]*)\}/g,(_,name:string)=>values[name]??`{${name}}`);}
