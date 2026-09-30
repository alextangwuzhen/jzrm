import type { Entity } from './store';

const escapeXml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]??char));
const short=(value:string,max=22)=>{const clean=value.trim().replace(/\s+/g,' ');return clean.length>max?`${clean.slice(0,max-1)}…`:clean;};
function labels(items:Entity[],type:'characters'|'map'|'timeline') {
  const base=items.filter(item=>!item.meta.imageData);
  if(type==='characters'){
    const names=base.flatMap(item=>{
      if(!/人物关系|relations/i.test(item.title)){
        if(!/人物档案|characters/i.test(item.title))return [item.title];
        return item.content.split('\n').map(line=>line.match(/^([\p{Script=Han}]{2,12})[：:]/u)?.[1]).filter((name):name is string=>typeof name==='string'&&!['作者原意','情绪基调','人物关系','对标原型','结局倾向'].includes(name));
      }
      return item.content.split('\n').flatMap(line=>{
        const match=line.match(/^(?:CP\s*[一二三四五六七八九十\d]+|父女|同门|旧情)[：:]\s*(.+)$/);
        if(!match)return [];
        return match[1].replace(/（.*?[）]/g,'').split(/\s*[×—/／]\s*/).map(name=>name.trim()).filter(name=>/^[\p{Script=Han}]{2,12}$/u.test(name));
      });
    });
    const unique=[...new Set(names)];
    return unique.filter(name=>!unique.some(other=>other!==name&&other.endsWith(name)&&other.length-name.length>=2)).slice(0,24).map(title=>({title:short(title,12),note:'人物档案'}));
  }
  if(type==='timeline')return [...base].sort((a,b)=>{
    const order=(item:Entity)=>{const match=String(item.meta.time??'').match(/(饶帝|羿帝)(\d+)年/);return match?Number(match[2])+(match[1]==='羿帝'?36:0):9999;};
    return order(a)-order(b);
  }).map(item=>({title:short(item.title,20),note:short(String(item.meta.time??item.content),32)})).slice(0,24);
  const rows=base.flatMap(item=>{
    const content=item.content.split('\n').map(line=>line.trim()).filter(Boolean);
    const extracted=content.map((line,i)=>{
      if(type==='map')return line.match(/[「“]([^」”]{2,12})[」”]/)?.[1]??(/^[\p{Script=Han}]{2,12}$/u.test(line)&&String(content[i+1]??'').length>8&&!['地名','出处','地点资料'].includes(line)?line:undefined);
      return undefined;
    }).filter((x):x is string=>Boolean(x));
    return extracted.length?extracted.map(title=>({title:short(title,12),note:short(item.title,24)})):[{title:short(item.title,12),note:short(item.content,24)}];
  });
  return [...new Map(rows.map(row=>[row.title,row])).values()].slice(0,24);
}
export function makeDiagramSvg(title:string,items:Entity[],type:'characters'|'map'|'timeline'):string{
  const rows=labels(items,type);
  const width=1200, columns=type==='timeline'?1:3, cardWidth=type==='timeline'?1040:330;
  const rowCount=Math.ceil(rows.length/columns),height=Math.max(520,180+rowCount*(type==='timeline'?88:132));
  const cards=rows.map((row,i)=>{
    const x=type==='timeline'?92:58+(i%columns)*382,y=142+Math.floor(i/columns)*(type==='timeline'?88:132);
    const marker=type==='timeline'?`<circle cx="48" cy="${y+34}" r="8" fill="#9ca8b4"/><line x1="48" y1="${y+43}" x2="48" y2="${Math.min(height-45,y+88)}" stroke="#c8d0d6" stroke-width="3"/>`:'';
    return `${marker}<rect x="${x}" y="${y}" width="${cardWidth}" height="${type==='timeline'?72:100}" rx="18" fill="#fff" stroke="#c9d1d7"/><text x="${x+22}" y="${y+34}" font-size="20" font-weight="700" fill="#2f3941">${escapeXml(row.title)}</text><text x="${x+22}" y="${y+61}" font-size="13" fill="#66737d">${escapeXml(row.note)}</text>`;
  }).join('');
  const edges=type==='characters'?items.flatMap(item=>item.content.split('\n').filter(line=>/CP|父女|同门|族群血债|依存与交易|旧情|关系/.test(line)).map(line=>{
    const found=rows.map((row,i)=>line.includes(row.title)?i:-1).filter(i=>i>=0);
    if(found.length<2||found.length>4)return '';
    const [a,b]=found;const ax=58+(a%columns)*382+cardWidth/2,ay=142+Math.floor(a/columns)*132+50,bx=58+(b%columns)*382+cardWidth/2,by=142+Math.floor(b/columns)*132+50;
    return `<path d="M${ax} ${ay} Q${(ax+bx)/2} ${(ay+by)/2-36} ${bx} ${by}" fill="none" stroke="#9aaab5" stroke-width="3" stroke-dasharray="7 5"/>`;
  })).join(''):'';
  const empty=rows.length?'':`<text x="60" y="190" font-size="20" fill="#68747e">先添加设定资料，再生成图表。</text>`;
  const note=type==='map'?'地点位置仅为排版示意；地理关系请在地点资料中确认。':type==='characters'?'只展示资料中明确出现的角色，不推断关系。':'按设定时间线顺序展示；具体年月请核对事件卡。';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f4f2ec"/><rect x="24" y="24" width="1152" height="${height-48}" rx="30" fill="#e8edf0" stroke="#d2d9de"/><text x="60" y="80" font-family="PingFang SC,Noto Sans CJK SC,sans-serif" font-size="30" font-weight="700" fill="#25313a">${escapeXml(title)}</text><text x="60" y="110" font-family="PingFang SC,Noto Sans CJK SC,sans-serif" font-size="14" fill="#66737d">${escapeXml(note)}</text><g font-family="PingFang SC,Noto Sans CJK SC,sans-serif">${edges}${cards}${empty}</g><text x="60" y="${height-46}" font-family="PingFang SC,Noto Sans CJK SC,sans-serif" font-size="12" fill="#87929a">JZRM · 使用系统字形生成，可编辑源设定后重新生成</text></svg>`;
}
export function svgDataUrl(svg:string){return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;}

/** Deterministic Chinese-label diagrams avoid garbled text from image models. */
export function relationshipDiagramSvg(title:string,items:Entity[]):string{
  const cards=items.filter(item=>!item.meta.imageData&&!['人物档案','人物关系'].includes(item.title)).slice(0,20);
  const names=cards.map(item=>item.title);
  const width=1700,cols=4,nodeW=270,rows=Math.max(1,Math.ceil(cards.length/cols)),height=Math.max(470,180+rows*190);
  const pos=(i:number)=>({x:62+(i%cols)*400,y:165+Math.floor(i/cols)*190});
  const edges:string[]=[];const edgeKeys=new Set<string>();
  const addEdge=(a:number,b:number,label:string)=>{if(a<0||b<0||a===b)return;const key=[a,b].sort((x,y)=>x-y).join('-');if(edgeKeys.has(key))return;edgeKeys.add(key);const A=pos(a),B=pos(b);const dx=B.x-A.x,dy=B.y-A.y;const horizontal=Math.abs(dx)>=Math.abs(dy);const x1=horizontal?A.x+(dx>0?nodeW:0):A.x+nodeW/2,y1=horizontal?A.y+42:A.y+(dy>0?84:0),x2=horizontal?B.x+(dx>0?0:nodeW):B.x+nodeW/2,y2=horizontal?B.y+42:B.y+(dy>0?0:84);const text=short(label||'关系',8);edges.push(`<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#1894bd" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/><rect x="${(x1+x2)/2-48}" y="${(y1+y2)/2-18}" width="96" height="25" rx="4" fill="#fff"/><text x="${(x1+x2)/2}" y="${(y1+y2)/2}" text-anchor="middle" font-size="15" fill="#465761">${escapeXml(text)}</text>`);};
  const docRelations=items.filter(item=>item.title.includes('关系')).flatMap(item=>item.content.split('\n'));
  for(const line of docRelations){if(!/^(?:CP\s*[一二三四五六七八九十\d]+|父女|父子|母女|母子|师徒|同门|旧情|好友|仇敌|依存与交易)[：:]/.test(line.trim()))continue;const hits=names.map((name,i)=>line.includes(name)?i:-1).filter(i=>i>=0);if(hits.length!==2)continue;addEdge(hits[0],hits[1],line.split(/[：:]/)[0]);}
  for(const card of cards){const rels=card.meta.relations;if(!Array.isArray(rels))continue;for(const r of rels){const target=String((r as Record<string,unknown>).target??'');const relation=String((r as Record<string,unknown>).relation??'');if(!target)continue;const a=names.indexOf(card.title);const b=names.indexOf(target);addEdge(a,b,relation||'关系');}}
  const nodes=cards.map((item,i)=>{const {x,y}=pos(i);return `<rect x="${x}" y="${y}" width="${nodeW}" height="84" fill="#f9f2e7" stroke="#27333b" stroke-width="1.5"/><text x="${x+nodeW/2}" y="${y+38}" text-anchor="middle" font-size="21" font-weight="700" fill="#26323a">${escapeXml(short(item.title,12))}</text>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#1894bd"/></marker></defs><g font-family="PingFang SC,Noto Sans CJK SC,sans-serif"><text x="70" y="65" font-size="31" font-weight="700" fill="#26343d">${escapeXml(title)}</text><text x="70" y="97" font-size="15" fill="#64727b">连线来自人物关系资料与角色档案中的人际关系；未定义的关系不推断。</text>${edges.join('')}${nodes}</g></svg>`;
}

export function timelineDiagramSvg(title:string,events:Entity[]):string{
  const ordered=events.filter(event=>!event.meta.imageData).slice(0,18);
  const width=Math.max(1300,ordered.length*235+120),height=650;
  const top=ordered.map((event,i)=>{const x=95+i*235,above=i%2===0;const y=above?190:405;const body=short(event.title,12);const detail=short(event.content,13);return `<line x1="${x}" y1="305" x2="${x}" y2="${above?255:375}" stroke="#272f36" stroke-width="2" marker-end="url(#timeArrow)"/><rect x="${x-88}" y="${y}" width="176" height="50" fill="#e7b635" stroke="#ac8620"/><text x="${x}" y="${y+32}" text-anchor="middle" font-size="17" font-weight="700" fill="#273039">${escapeXml(short(String(event.meta.time??'未定'),14))}</text><text x="${x}" y="${above?155:490}" text-anchor="middle" font-size="20" font-weight="700" fill="#303a43">${escapeXml(body)}</text>${detail?`<text x="${x}" y="${above?179:518}" text-anchor="middle" font-size="13" fill="#647079">${escapeXml(detail)}</text>`:''}`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><defs><marker id="timeArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10" fill="#29353e"/></marker></defs><g font-family="PingFang SC,Noto Sans CJK SC,sans-serif"><text x="70" y="65" font-size="31" font-weight="700" fill="#26343d">${escapeXml(title)}</text><text x="70" y="99" font-size="15" fill="#65727b">按当前事件卡顺序排列 · 可回到时间线拖动调整</text><line x1="70" y1="315" x2="${width-70}" y2="315" stroke="#202a31" stroke-width="8"/>${top}</g></svg>`;
}
