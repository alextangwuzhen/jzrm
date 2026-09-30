export interface AiTraceHit { level: 'P0' | 'P1'; rule: string; quote: string; count: number }
export interface AiTraceStats {
  sentenceCount: number;
  avgSentenceLen: number;
  burstiness: number;
  repeatedPhrases: Array<{ phrase: string; count: number }>;
  emotionLabelCount: number;
}
export interface AiTraceReport { hits: AiTraceHit[]; stats: AiTraceStats; rate: number }

const p0Patterns: Array<[string, RegExp]> = [
  ['感悟式结尾（他终于明白/这一刻终于明白）', /(?:他终于明白|她终于懂得|这一刻终于明白|他终于懂得|这一刻，?他(?:终于)?明白)/g],
  ['明显AI词汇（众所周知/不言而喻/毋庸置疑）', /(?:众所周知|不言而喻|毋庸置疑|显而易见|毋庸置疑地)/g],
  ['感叹式收束（真是太/多么…）', /(?:真是太|多么(?:地|的)?(?:感人|美好|震撼|精彩|完美|强大))/g],
  ['上帝视角（所有人没想到/谁也没想到）', /(?:所有人(?:都)?没想到|谁也没想到|没有人会想到)/g],
  ['命运齿轮（命运的齿轮）', /命运的?齿轮(?:开始)?转动/g]
];
const p1Patterns: Array<[string, RegExp]> = [
  ['泛用比喻（仿佛/宛如）', /(?:仿佛|宛如|好像?置身)/g],
  ['万能量词（一丝/一抹/一缕）', /(?:一丝|一抹|一缕)(?:的)?/g],
  ['机械过渡（此时此刻/与此同时）', /(?:此时此刻|与此同时)/g],
  ['表情槽位（眼中闪过一丝）', /眼中(?:又|不)?(?:地)?闪过一丝/g],
  ['对仗句式（不是…而是…）', /不是[^。；!?！？\n]{2,30}而是/g],
  ['空洞程度词（无比/极其/非常+形容词）', /(?:无比|极其|格外|分外)(?:地|的)?[^\s，。；]{1,6}/g],
  ['套话（仿佛有一股/心中一动/心中一惊）', /(?:心中一动|心中一惊|心头一震|不禁(?:地)?(?:想|一怔|愣))/g],
  ['排比标记（三个及以上同构短语）', /(?:一个[^，。；]{2,8}，一个[^，。；]{2,8}，一个[^，。；]{2,8})/g]
];
const emotionWords = ['快乐', '开心', '喜悦', '悲伤', '难过', '愤怒', '恐惧', '紧张', '释怀', '委屈', '热血', '平静', '不安', '纠结', '痛苦', '甜蜜', '酸楚'];

export function scanAiTraces(text: string): AiTraceReport {
  const hits: AiTraceHit[] = [];
  const push = (level: 'P0' | 'P1', rule: string, count: number, quote: string) => {
    if (count <= 0) return;
    hits.push({ level, rule, quote, count });
  };
  for (const [rule, re] of p0Patterns) {
    const matches = text.match(re) ?? [];
    push('P0', rule, matches.length, matches[0] ?? '');
  }
  for (const [rule, re] of p1Patterns) {
    const matches = text.match(re) ?? [];
    push('P1', rule, matches.length, matches[0] ?? '');
  }

  const sentences = text.split(/[。！？!?…\n]+/).map(s => s.replace(/\s/g, '')).filter(s => s.length > 1);
  const lens = sentences.map(s => s.length);
  const sentenceCount = lens.length;
  const avgSentenceLen = sentenceCount ? lens.reduce((a, b) => a + b, 0) / sentenceCount : 0;
  const variance = sentenceCount ? lens.reduce((a, b) => a + (b - avgSentenceLen) ** 2, 0) / sentenceCount : 0;
  const burstiness = Math.sqrt(variance);

  const gramCount = new Map<string, number>();
  for (const s of sentences) {
    for (let i = 0; i + 4 <= s.length; i++) {
      const g = s.slice(i, i + 4);
      gramCount.set(g, (gramCount.get(g) ?? 0) + 1);
    }
  }
  const repeatedPhrases = [...gramCount.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([phrase, count]) => ({ phrase, count }));

  const emotionLabelCount = emotionWords.reduce((n, w) => n + (text.split(w).length - 1), 0);

  let rate = 12;
  for (const h of hits) rate += h.level === 'P0' ? Math.min(18, h.count * 15) : Math.min(30, h.count * 4);
  if (sentenceCount >= 5 && burstiness < 3) rate += 12;
  if (repeatedPhrases.length >= 3) rate += 8;
  if (sentenceCount > 0 && emotionLabelCount > sentenceCount * 0.6) rate += 6;
  rate = Math.max(0, Math.min(95, Math.round(rate)));

  return { hits, stats: { sentenceCount, avgSentenceLen: Math.round(avgSentenceLen * 10) / 10, burstiness: Math.round(burstiness * 10) / 10, repeatedPhrases, emotionLabelCount }, rate };
}
