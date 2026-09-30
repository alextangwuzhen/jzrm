import type { AppState } from './store';

export interface ModelInput { providerId: string; baseUrl: string; model: string; protocol?: 'openai'|'anthropic'|'gemini'; prompt?: string; temperature?: number }
export interface WebResult { title: string; url: string; published: string; excerpt: string }
export interface PlatformApi {
  load(): Promise<AppState>;
  save(state: AppState): Promise<boolean>;
  saveKey(id: string, key: string): Promise<boolean>;
  keyStatus(id: string): Promise<boolean>;
  clearKey(id: string): Promise<boolean>;
  testModel(input: ModelInput): Promise<string>;
  localModels(): Promise<string[]>;
  runAi(input: ModelInput & { prompt: string }): Promise<string>;
  generateImage(input: ModelInput & { prompt: string }): Promise<string>;
  imageModels(input: ModelInput): Promise<string[]>;
  searchWeb(query: string): Promise<WebResult[]>;
  searchNovelWeb(query: string): Promise<WebResult[]>;
  usage(): Promise<Array<{model:string;providerId:string;input:number;output:number;at:string}>>;
  importText(): Promise<{ name: string; text: string } | null>;
  importImage(): Promise<{ name: string; dataUrl: string } | null>;
  exportFile(input: { title: string; content: string; format: 'txt' | 'docx' | 'pdf' }): Promise<string | null>;
  backup(): Promise<string | null>;
  restoreBackup(): Promise<AppState | null>;
  cloudPush(state: AppState): Promise<{ id: string; at: string }>;
  cloudPull(): Promise<AppState>;
  cloudStatus(): Promise<{ configured: boolean; syncedAt: string | null }>;
  appVersion(): Promise<string>;
}

declare global { interface Window { jzrm?: PlatformApi } }

const browserFallback: PlatformApi = {
  async load() { const { createInitialState } = await import('./store'); return JSON.parse(localStorage.getItem('jzrm-dev-state') || 'null') ?? createInitialState(); },
  async save(state) { localStorage.setItem('jzrm-dev-state', JSON.stringify(state)); return true; },
  async saveKey() { throw new Error('API 密钥只能在桌面 App 中保存'); },
  async keyStatus() { return false; },
  async clearKey() { throw new Error('请在桌面 App 中清除密钥'); },
  async testModel() { throw new Error('请在桌面 App 中测试模型'); },
  async localModels() { return []; },
  async runAi() { throw new Error('请在桌面 App 中使用 AI'); },
  async generateImage() { throw new Error('请在桌面 App 中生成图片'); },
  async imageModels() { return []; },
  async searchWeb() { throw new Error('请在桌面 App 中联网搜索'); },
  async searchNovelWeb() { throw new Error('请在桌面 App 中联网搜索'); },
  async usage() { return []; },
  async importText() { throw new Error('请在桌面 App 中导入文件'); },
  async importImage() { throw new Error('请在桌面 App 中导入图片'); },
  async exportFile(input) { const blob = new Blob([input.content], { type: 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${input.title}.txt`; a.click(); URL.revokeObjectURL(a.href); return a.download; },
  async backup() { throw new Error('请在桌面 App 中备份'); },
  async restoreBackup() { throw new Error('请在桌面 App 中恢复备份'); },
  async cloudPush() { throw new Error('请在桌面 App 中使用云同步'); },
  async cloudPull() { throw new Error('请在桌面 App 中使用云同步'); },
  async cloudStatus() { return { configured: false, syncedAt: null }; },
  async appVersion() { return '开发预览'; }
};

export const platform = (): PlatformApi => window.jzrm ?? browserFallback;
