import { createEntity, updateEntity, type AppState } from './store';

const presets = [
  { id: 'male-trend', title: '男频热榜叙事观察', content: '快节奏目标推进，清晰的行动反馈，关键节点用具体选择制造悬念。保持角色行动的代价与因果，不堆设定说明。', example: '门外的脚步停了。沈砚把信折回原样，先吹灭了灯。', status: '待联网刷新' },
  { id: 'female-trend', title: '女频热榜情绪观察', content: '以关系变化带动事件，情绪通过动作和选择呈现；保留人物边界与双向意愿，避免空泛独白。', example: '她把伞推回他手里，自己走进雨里。那句道歉，留在站台上。', status: '待联网刷新' },
  { id: 'short-drama', title: '红果短剧台词节奏', content: '台词短而有指向，每轮对话改变局势；反转建立在先前信息上，避免只靠喊话。', example: '“钥匙在你手里。”她看了眼门锁，“可门是从里面开的。”', status: '待联网刷新' },
  { id: 'social-memes', title: '社媒热梗语感', content: '将当下口语的轻快感放入合适角色，不强塞梗；先判断时代与人物身份，再少量使用。', example: '他盯着那份计划，半天才说：“你这一步，倒是挺敢想。”', status: '待联网刷新' },
  { id: 'qiongyao', title: '琼瑶作品情绪叙事观察', content: '关注强烈关系冲突、重复意象和情绪转折；用原创场景表达，避免照搬原句与人物。', example: '她想叫住他，声音却被风吹散，只好握紧那张未寄出的信。', status: '抽象特征' },
  { id: 'wuxia', title: '金庸与古龙武侠叙事观察', content: '兼顾江湖群像与利落留白，行动中显露人物信义和处境；句式随场景疏密变化。', example: '酒已凉了。客栈里没人再提那把剑，只有窗边的影子仍未坐下。', status: '抽象特征' }
];

export function seedStyles(state: AppState): AppState {
  let next = state;
  for (const preset of presets) {
    const id = `preset:${preset.id}`;
    const existing=next.entities.find(e=>e.id===id);
    if(existing){
      if(['male-trend','female-trend'].includes(preset.id)&&Array.isArray(existing.meta.sourceLinks)&&existing.meta.sourceLinks.some(url=>!/(^|\.)((qidian|qdmm|qimao|fanqienovel)\.com|biquge\.net|biqugm\.com|bqggi\.com)(\/|$)/.test(String(url).replace(/^https?:\/\//,'').replace(/^www\./,'')))){
        next=updateEntity(next,id,{content:preset.content,meta:{...existing.meta,example:preset.example,sourceLinks:[],topWorks:[],sourceDate:null,sourceStatus:'待按网文平台更新',uncertainty:'旧联网来源不符合网文平台限定，已清除；请点击联网更新。'}});
      }
      continue;
    }
    next = createEntity(next, { id, kind: 'style', title: preset.title, content: preset.content, meta: { example: preset.example, sourceStatus: preset.status, builtIn: true, sourceDate: null } });
  }
  return next;
}
