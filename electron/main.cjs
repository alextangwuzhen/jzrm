const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require('electron');
const { readFile, writeFile, rename, mkdir, copyFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Document, Packer, Paragraph, HeadingLevel } = require('docx');
const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');
const { searchWeb, searchNovelWeb } = require('./web.cjs');
const { imageRequest, imageResult, imageModelIds } = require('./image.cjs');

let win;
const dataPath = () => path.join(app.getPath('userData'), 'jzrm-state.json');
const keyPath = () => path.join(app.getPath('userData'), 'keys.json');
const usagePath = () => path.join(app.getPath('userData'), 'usage.json');
const emptyState = () => ({ version: 1, entities: [], preferences: { theme: 'light' } });
const readJson = async (file, fallback) => { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; } };
async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await rename(temp, file);
}
function validSender(event) { if (!win || event.sender !== win.webContents) throw new Error('INVALID_SENDER'); }
function validateProvider(input) {
  if (!input || typeof input.baseUrl !== 'string' || typeof input.model !== 'string') throw new Error('INVALID_MODEL');
  const url = new URL(input.baseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('HTTPS_REQUIRED');
  return url;
}
async function getKey(id) {
  const map = await readJson(keyPath(), {});
  const encoded = map[String(id)];
  if (!encoded) throw new Error('API_KEY_MISSING');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('KEYCHAIN_UNAVAILABLE');
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
}
async function callModel(input, prompt) {
  const base = validateProvider(input);
  const local = base.protocol === 'http:' && ['localhost','127.0.0.1'].includes(base.hostname);
  const key = local ? 'ollama' : await getKey(input.providerId);
  const protocol = input.protocol || 'openai';
  let endpoint;
  let headers = { 'Content-Type': 'application/json' };
  let body;
  if (protocol === 'anthropic') {
    endpoint = base.pathname.endsWith('/v1/messages') ? base : new URL(`${base.pathname.replace(/\/$/,'')}/v1/messages`, base);
    headers = { ...headers, 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    body = { model: input.model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] };
  } else if (protocol === 'gemini') {
    endpoint = new URL(`/v1beta/models/${encodeURIComponent(input.model)}:generateContent`, base);
    headers = { ...headers, 'x-goog-api-key': key };
    body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: input.temperature ?? 0.7 } };
  } else if (protocol === 'openai') {
    endpoint = base.pathname.endsWith('/chat/completions') ? base : new URL(`${base.pathname.replace(/\/$/,'')}/chat/completions`, base);
    headers = { ...headers, Authorization: `Bearer ${key}` };
    body = { model: input.model, messages: [{ role: 'user', content: prompt }], temperature: input.temperature ?? 0.7 };
  } else throw new Error('UNSUPPORTED_PROTOCOL');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', signal: controller.signal,
      headers,
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`模型请求失败 ${response.status}: ${String(payload.error?.message ?? '').slice(0, 200)}`);
    const content = protocol === 'anthropic' ? payload.content?.filter(part => part.type === 'text').map(part => part.text).join('\n') : protocol === 'gemini' ? payload.candidates?.[0]?.content?.parts?.filter(part => typeof part.text === 'string').map(part => part.text).join('\n') : payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('模型返回空文本');
    try {
      const usage = await readJson(usagePath(), []);
      usage.push({ model: input.model, providerId: input.providerId, input: Number(payload.usage?.prompt_tokens ?? payload.usage?.input_tokens ?? payload.usageMetadata?.promptTokenCount ?? 0), output: Number(payload.usage?.completion_tokens ?? payload.usage?.output_tokens ?? payload.usageMetadata?.candidatesTokenCount ?? 0), at: new Date().toISOString() });
      await atomicJson(usagePath(), usage.slice(-2000));
    } catch { /* A logging failure must not discard a successful model response. */ }
    return content;
  } finally { clearTimeout(timer); }
}
async function createImage(input) {
  validateProvider(input);
  if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 12000) throw new Error('INVALID_IMAGE_PROMPT');
  const key = await getKey(input.providerId);
  const request = imageRequest(input,key);
  const response = await fetch(request.endpoint, {
    method: 'POST', signal: AbortSignal.timeout(120000),
    headers: request.headers,
    body: JSON.stringify(request.body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`图片模型请求失败 ${response.status}: ${String(payload.error?.message ?? payload.error?.status ?? JSON.stringify(payload).slice(0,200)).slice(0, 200)}`);
  const result = imageResult(payload,input.protocol||'openai');
  if (result?.startsWith('data:')) return result;
  if (result) {
    const imageUrl = new URL(result);
    if (imageUrl.protocol !== 'https:') throw new Error('图片返回地址必须为 HTTPS');
    const image = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (!image.ok) throw new Error(`下载生成图片失败：${image.status}`);
    const bytes = Buffer.from(await image.arrayBuffer());
    if (bytes.length > 15_000_000) throw new Error('生成图片超过 15 MB');
    const type = image.headers.get('content-type')?.split(';')[0];
    if (!['image/png','image/jpeg','image/webp'].includes(type)) throw new Error('图片服务返回了非图片内容');
    return `data:${type};base64,${bytes.toString('base64')}`;
  }
  throw new Error('图片模型没有返回图片');
}
async function listImageModels(input) {
  const base=validateProvider(input);
  const key=await getKey(input.providerId);
  const protocol=input.protocol||'openai';
  if(protocol==='gemini'){
    const response=await fetch(new URL('/v1beta/models?pageSize=1000',base),{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(15000)});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(`模型列表请求失败 ${response.status}: ${String(payload.error?.message??'').slice(0,160)}`);
    return imageModelIds(payload,protocol);
  }
  if(protocol==='openai'){
    const endpoint=new URL(`${base.pathname.replace(/\/$/,'')}/models`,base);
    const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(`模型列表请求失败 ${response.status}: ${String(payload.error?.message??'').slice(0,160)}`);
    return imageModelIds(payload,protocol);
  }
  throw new Error('该协议不支持在线拉取生图模型');
}
function escapeHtml(text) { return text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function createPdf(title, content) {
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false } });
  const html = `<html><meta charset="utf-8"><style>body{font-family:PingFang SC,Hiragino Sans GB,sans-serif;color:#24211d;padding:48px;line-height:1.8;white-space:pre-wrap}h1{font-size:24px}</style><h1>${escapeHtml(title)}</h1>${escapeHtml(content)}</html>`;
  await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdf = await pdfWin.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  pdfWin.close();
  return pdf;
}
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 690, title: 'JZRM',
    backgroundColor: '#f4f0e8',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('file://') && !url.startsWith('http://127.0.0.1:4173/')) event.preventDefault(); });
  if (process.env.JZRM_DEV_URL) win.loadURL(process.env.JZRM_DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('state:load', async event => { validSender(event); return readJson(dataPath(), emptyState()); });
  ipcMain.handle('state:save', async (event, state) => {
    validSender(event);
    if (!state || state.version !== 1 || !Array.isArray(state.entities)) throw new Error('INVALID_STATE');
    await atomicJson(dataPath(), state); return true;
  });
  ipcMain.handle('key:save', async (event, id, key) => {
    validSender(event);
    if (!safeStorage.isEncryptionAvailable()) throw new Error('KEYCHAIN_UNAVAILABLE');
    if (typeof id !== 'string' || typeof key !== 'string' || !key.trim()) throw new Error('INVALID_KEY');
    const map = await readJson(keyPath(), {});
    map[id] = safeStorage.encryptString(key.trim()).toString('base64');
    await atomicJson(keyPath(), map); return true;
  });
  ipcMain.handle('key:status', async (event, id) => { validSender(event); return Boolean((await readJson(keyPath(), {}))[String(id)]); });
  ipcMain.handle('key:clear', async (event, id) => { validSender(event); const map=await readJson(keyPath(), {}); delete map[String(id)]; await atomicJson(keyPath(), map); return true; });
  ipcMain.handle('ai:test', async (event, input) => { validSender(event); return callModel(input, '请只回答：连接成功'); });
  ipcMain.handle('local:models', async event => {
    validSender(event);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: controller.signal });
      if (!response.ok) throw new Error(`本地模型服务返回 ${response.status}`);
      const payload = await response.json();
      return Array.isArray(payload.models) ? payload.models.map(model => String(model.name || '')).filter(Boolean) : [];
    } finally { clearTimeout(timer); }
  });
  ipcMain.handle('ai:run', async (event, input) => {
    validSender(event);
    if (!input || typeof input.prompt !== 'string' || input.prompt.length > 200000) throw new Error('INVALID_PROMPT');
    return callModel(input, input.prompt);
  });
  ipcMain.handle('image:generate', async (event, input) => { validSender(event); return createImage(input); });
  ipcMain.handle('image:models', async (event, input) => { validSender(event); return listImageModels(input); });
  ipcMain.handle('web:search', async (event, query) => { validSender(event); const hasBocha=Boolean((await readJson(keyPath(), {}))['search:bocha']); return searchWeb(query,hasBocha?await getKey('search:bocha'):''); });
  ipcMain.handle('web:novel-search', async (event, query) => { validSender(event); const hasBocha=Boolean((await readJson(keyPath(), {}))['search:bocha']); return searchNovelWeb(query,hasBocha?await getKey('search:bocha'):''); });
  ipcMain.handle('usage:list', async event => { validSender(event); return readJson(usagePath(), []); });
  ipcMain.handle('file:import', async event => {
    validSender(event);
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: '文稿', extensions: ['txt','md','docx','pdf'] }] });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    const ext = path.extname(file).toLowerCase();
    if (ext === '.docx') return { name: path.basename(file), text: (await mammoth.extractRawText({ path: file })).value };
    if (ext === '.pdf') {
      const parser = new PDFParse({ data: await readFile(file) });
      try { return { name: path.basename(file), text: (await parser.getText()).text }; }
      finally { await parser.destroy(); }
    }
    return { name: path.basename(file), text: await readFile(file, 'utf8') };
  });
  ipcMain.handle('image:import', async event => {
    validSender(event);
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: '图片', extensions: ['png','jpg','jpeg','webp'] }] });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    const data = await readFile(file);
    if (data.length > 12 * 1024 * 1024) throw new Error('图片不能超过 12 MB');
    const ext = path.extname(file).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { name: path.basename(file), dataUrl: `data:${mime};base64,${data.toString('base64')}` };
  });
  ipcMain.handle('file:export', async (event, input) => {
    validSender(event);
    const { title, content, format } = input ?? {};
    if (typeof title !== 'string' || typeof content !== 'string' || !['txt','docx','pdf'].includes(format)) throw new Error('INVALID_EXPORT');
    const result = await dialog.showSaveDialog(win, { defaultPath: `${title}.${format}` });
    if (result.canceled || !result.filePath) return null;
    if (format === 'txt') await writeFile(result.filePath, content, 'utf8');
    if (format === 'docx') {
      const doc = new Document({ sections: [{ children: [new Paragraph({ text: title, heading: HeadingLevel.TITLE }), ...content.split('\n').map(line => new Paragraph({ text: line }))] }] });
      await writeFile(result.filePath, await Packer.toBuffer(doc));
    }
    if (format === 'pdf') await writeFile(result.filePath, await createPdf(title, content));
    return result.filePath;
  });
  ipcMain.handle('state:backup', async event => {
    validSender(event);
    const result = await dialog.showSaveDialog(win, { defaultPath: 'JZRM-backup.json' });
    if (result.canceled || !result.filePath) return null;
    await copyFile(dataPath(), result.filePath); return result.filePath;
  });
  ipcMain.handle('state:restore', async event => {
    validSender(event);
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JZRM 备份', extensions: ['json'] }] });
    if (result.canceled) return null;
    const state = JSON.parse(await readFile(result.filePaths[0], 'utf8'));
    if (state.version !== 1 || !Array.isArray(state.entities)) throw new Error('备份格式不正确');
    if (existsSync(dataPath())) await copyFile(dataPath(), `${dataPath()}.${Date.now()}.before-restore`);
    await atomicJson(dataPath(), state); return state;
  });
  ipcMain.handle('app:version', event => { validSender(event); return app.getVersion(); });
  const GIST_DESC = 'jzrm-cloud-sync';
  const GIST_FILE = 'jzrm-state.json';
  async function gistRequest(method, path, token, body) {
    const response = await fetch(`https://api.github.com${path}`, {
      method, signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'JZRM' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) throw new Error(`GitHub 同步失败 ${response.status}: ${String(((await response.json().catch(() => ({}))) || {}).message ?? '').slice(0, 200)}`);
    return response.json();
  }
  async function findGist(token) {
    const list = await gistRequest('GET', '/gists?per_page=100', token);
    return (Array.isArray(list) ? list : []).find(g => g && (g.description === GIST_DESC || (g.files && GIST_FILE in g.files)));
  }
  ipcMain.handle('sync:push', async (event, state) => {
    validSender(event);
    if (!state || state.version !== 1 || !Array.isArray(state.entities)) throw new Error('INVALID_STATE');
    const token = await getKey('sync:github');
    const body = { description: GIST_DESC, public: false, files: { [GIST_FILE]: { content: JSON.stringify(state) } } };
    const existing = await findGist(token);
    const gist = existing ? await gistRequest('PATCH', `/gists/${existing.id}`, token, body) : await gistRequest('POST', '/gists', token, body);
    return { id: String(gist.id ?? ''), at: new Date().toISOString() };
  });
  ipcMain.handle('sync:pull', async event => {
    validSender(event);
    const token = await getKey('sync:github');
    const gist = await findGist(token);
    if (!gist) throw new Error('云端还没有同步记录');
    const detail = await gistRequest('GET', `/gists/${gist.id}`, token);
    const file = detail?.files?.[GIST_FILE];
    let content = typeof file?.content === 'string' ? file.content : '';
    if (!content && typeof file?.raw_url === 'string') content = await (await fetch(file.raw_url, { signal: AbortSignal.timeout(15000) })).text();
    if (!content) throw new Error('云端文件为空');
    const parsed = JSON.parse(content);
    if (parsed.version !== 1 || !Array.isArray(parsed.entities)) throw new Error('云端数据格式不正确');
    return parsed;
  });
  ipcMain.handle('sync:status', async event => {
    validSender(event);
    const hasToken = Boolean((await readJson(keyPath(), {}))['sync:github']);
    if (!hasToken) return { configured: false, syncedAt: null };
    try { const gist = await findGist(await getKey('sync:github')); return { configured: true, syncedAt: gist ? String(gist.updated_at ?? null) : null }; }
    catch { return { configured: true, syncedAt: null }; }
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
