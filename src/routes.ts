export const workPages = ['outline', 'settings', 'memory', 'fine-outline', 'body'] as const;
export type WorkPage = typeof workPages[number];
export const settingCategories = ['overview', 'characters', 'emotion', 'world', 'map', 'timeline', 'foreshadow', 'style'] as const;

export function routeFor(workId: string, page: WorkPage, category?: string): string {
  return `/work/${encodeURIComponent(workId)}/${page}${category ? `/${category}` : ''}`;
}

export function parseRoute(path: string): { workId?: string; page: string; category?: string } {
  const parts = path.split('?')[0].replace(/^\/+|\/+$/g, '').split('/');
  if (parts[0] === 'work' && parts[1]) return { workId: decodeURIComponent(parts[1]), page: parts[2] ?? 'body', category: parts[3] };
  return { page: parts[0] || 'home', category: parts[1] };
}
