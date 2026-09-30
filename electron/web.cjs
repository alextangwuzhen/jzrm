const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { existsSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const runFile = promisify(execFile);

function parseExa(text) {
  return text.split(/(?=^Title: )/m).filter(part => part.startsWith('Title: ')).map(part => {
    const title = part.match(/^Title: (.*)$/m)?.[1]?.trim() || '未命名来源';
    const url = part.match(/^URL: (https?:\/\/\S+)/m)?.[1] || '';
    const published = part.match(/^Published: (.*)$/m)?.[1]?.trim() || '';
    const excerpt = part.split(/^Highlights:\s*/m)[1]?.trim().slice(0, 2500) || '';
    return { title, url, published, excerpt };
  }).filter(item => item.url);
}

function parseBocha(payload) {
  const result = payload?.data ?? payload;
  const rows = result?.webPages?.value ?? [];
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => typeof row?.url === 'string' && /^https?:\/\//.test(row.url)).map(row => ({
    title: String(row.name || row.title || row.url),
    url: row.url,
    published: String(row.datePublished || row.dateLastCrawled || ''),
    excerpt: String(row.summary || row.snippet || '').slice(0, 2500)
  }));
}

function cliPath() {
  const personal = path.join(os.homedir(), '.local/bin/mcporter');
  return existsSync(personal) ? personal : 'mcporter';
}

async function searchWeb(query, bochaKey = '') {
  const cleaned = String(query || '').trim();
  if (!cleaned || cleaned.length > 500) throw new Error('搜索词需要在 1～500 字之间');
  if (/^https?:\/\//i.test(cleaned)) {
    const url = new URL(cleaned);
    const response = await fetch(`https://r.jina.ai/${url.href}`, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`读取网页失败：${response.status}`);
    const excerpt = (await response.text()).slice(0, 20000);
    return [{ title: excerpt.match(/^Title: (.*)$/m)?.[1] || url.hostname, url: url.href, published: '', excerpt }];
  }
  if (bochaKey) {
    const response = await fetch('https://api.bochaai.com/v1/web-search', {
      method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${bochaKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cleaned, freshness: 'noLimit', summary: true, count: 8 })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || (payload.code && payload.code !== 200)) throw new Error(`博查搜索失败：${String(payload.message || response.status).slice(0,180)}`);
    const results = parseBocha(payload);
    if (!results.length) throw new Error('博查未返回可核对的网页来源');
    return results;
  }
  const env = { ...process.env, PATH: [path.join(os.homedir(), '.local/bin'), path.join(os.homedir(), '.local/opt/node-v24.19.0-darwin-arm64/bin'), '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH].join(':') };
  let output;
  try {
    output = await runFile(cliPath(), ['call', `exa.web_search_exa(query: ${JSON.stringify(cleaned)}, numResults: 6)`], { timeout: 30000, maxBuffer: 4_000_000, env });
  } catch (error) {
    throw new Error(`联网搜索暂不可用，请检查 agent-reach/Exa：${String(error.message || error).slice(0, 180)}`);
  }
  const items = parseExa(output.stdout);
  if (!items.length) throw new Error('搜索未返回可核对的来源');
  return items;
}

const novelDomains = ['qidian.com', 'qdmm.com', 'biquge.net', 'biqugm.com', 'bqggi.com', 'qimao.com', 'fanqienovel.com'];
function isNovelSource(result) {
  try { const host = new URL(result.url).hostname.toLowerCase(); return novelDomains.some(domain => host === domain || host.endsWith(`.${domain}`)); }
  catch { return false; }
}
function rankedBooks(markdown, url) {
  const rows = markdown.split('\n');
  if (url.includes('qidian.com/rank/mm/')) return rows.filter(line => /^\*\s+[1-5]\[/.test(line)).map(line => {
    const match=line.match(/Image \d+: (.+?)在线阅读\]\([^)]*\)\]\((https:\/\/www\.qdmm\.com\/book\/\d+\/)/);
    return match ? {name:match[1],url:match[2]} : null;
  }).filter(Boolean).slice(0,5);
  if (url.includes('qidian.com')) return rows.filter(line => /^\*\s+[1-5]\[/.test(line)).map(line => {
    const match=line.match(/## \[([^\]]+)\]\((https:\/\/www\.qidian\.com\/book\/\d+\/)/);
    return match ? {name:match[1],url:match[2]} : null;
  }).filter(Boolean).slice(0,5);
  if (url.includes('qimao.com')) return rows.filter(line => /^\*\s+\[!\[Image/.test(line) && /\]\(https:\/\/www\.qimao\.com\/shuku\//.test(line)).map(line => {
    const match=line.match(/\]\(https:\/\/www\.qimao\.com\/shuku\/\d+\/\) \[([^\]]+)\]\((https:\/\/www\.qimao\.com\/shuku\/\d+\/)/);
    return match ? {name:match[1],url:match[2]} : null;
  }).filter(Boolean).slice(0,5);
  return [];
}
async function searchNovelWeb(query, bochaKey = '') {
  const cleaned = String(query || '').trim();
  if (!cleaned || cleaned.length > 500) throw new Error('搜索词需要在 1～500 字之间');
  if (/^https?:\/\//i.test(cleaned)) {
    if (!isNovelSource({url: cleaned})) throw new Error('网文搜索仅支持起点、笔趣阁、七猫、番茄小说的链接');
    return searchWeb(cleaned, bochaKey);
  }
  const female=/女频|女生/.test(cleaned);
  const rankings = [
    {title:female?'起点女生月票榜':'起点月票榜',url:female?'https://www.qidian.com/rank/mm/yuepiao/':'https://www.qidian.com/rank/yuepiao/'},
    {title:'笔趣阁人气榜',url:'https://www.biqugm.com/rank/allvisit/'},
    {title:female?'七猫女生大热榜':'七猫男生大热榜',url:female?'https://www.qimao.com/paihang/girl/hot/date/':'https://www.qimao.com/paihang/boy/hot/date/'},
    {title:'番茄小说排行榜',url:'https://fanqienovel.com/rank'}
  ];
  const readRankings = async () => Promise.allSettled(rankings.map(async rank => {
    const response = await fetch(`https://r.jina.ai/${rank.url}`, {signal:AbortSignal.timeout(18000)});
    if (!response.ok) throw new Error(String(response.status));
    const content = await response.text();
    const books=rankedBooks(content,rank.url);
    return {...rank,published:new Date().toISOString().slice(0,10),excerpt:books.length?`榜单前${books.length}名：${books.map((book,i)=>`${i+1}. ${book.name} (${book.url})`).join('；')}`:'榜单页可用，未能可靠提取前五书名；请打开来源核对。'};
  }));
  if (/月票榜|人气榜|热榜/.test(cleaned)) {
    const pages=await readRankings();
    const fallback=pages.flatMap(item=>item.status==='fulfilled'?[item.value]:[]);
    if(fallback.some(item=>item.excerpt.startsWith('榜单前')))return fallback;
  }
  const domains = ['qidian.com', 'biquge.net', 'qimao.com', 'fanqienovel.com'];
  const attempts = await Promise.allSettled(domains.map(domain => searchWeb(`${cleaned} site:${domain}`, bochaKey)));
  const matches = attempts.flatMap(item => item.status === 'fulfilled' ? item.value : []).filter(isNovelSource);
  const unique = [...new Map(matches.map(item => [item.url, item])).values()].slice(0, 20);
  if (unique.length) return unique;
  const pages=await readRankings();
  const fallback = pages.flatMap(item => item.status === 'fulfilled' ? [item.value] : []);
  if (!fallback.length) throw new Error('网文平台搜索与榜单页暂不可用');
  return fallback;
}

module.exports = { parseExa, parseBocha, searchWeb, searchNovelWeb, isNovelSource, rankedBooks };
