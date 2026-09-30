export interface TimelineEvent { id: string; time: string; title: string; knowers: string[]; public: boolean; memory?: boolean; description?: string }

export function buildRolePrompt(role: string, events: TimelineEvent[], source: string): string {
  const visible = events.filter(event => event.public || event.knowers.includes(role));
  return `请把小说改编为角色「${role}」的剧本杀角色本。使用第二人称“你”叙述，禁止写出该角色尚不知道的私有事实。\n小说素材：${source}\n该角色可知的现实事件与回忆：\n${visible.map(event => `${event.time} ${event.memory ? '[回忆]' : '[现实]'} ${event.title}${event.description ? `：${event.description}` : ''}`).join('\n')}\n每章末列出现实时间线对齐点，回忆与现实分开。输出可编辑角色文本。`;
}

export function alignmentIssues(events: TimelineEvent[]): string[] {
  const byTitle = new Map<string, Set<string>>();
  for (const event of events.filter(e => !e.memory)) {
    if (!byTitle.has(event.title)) byTitle.set(event.title, new Set());
    byTitle.get(event.title)!.add(event.time);
  }
  return [...byTitle.entries()].filter(([,times]) => times.size > 1).map(([title,times]) => `“${title}”存在不同现实时间：${[...times].join('、')}`);
}
