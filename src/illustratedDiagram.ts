const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]??c));
export function illustratedDiagramSvg(title:string,imageData:string,names:string[],events:string[]=[]):string{
 const places=names.slice(0,10).map((name,i)=>{
  const x=90+(i%3)*380+(Math.floor(i/3)%2)*65,y=180+Math.floor(i/3)*145;
  return `<text x="${x}" y="${y}" font-size="24" font-weight="700" fill="#202c2f" stroke="#fcf8ed" stroke-width="6" paint-order="stroke">${esc(name)}</text>`;
 }).join('');
 const notes=events.slice(0,5).map((event,i)=>`<g><text x="${70+i*220}" y="720" font-size="14" fill="#202c2f" stroke="#fcf8ed" stroke-width="5" paint-order="stroke">${esc(event.slice(0,13))}</text><text x="${70+i*220}" y="745" font-size="12" fill="#202c2f" stroke="#fcf8ed" stroke-width="4" paint-order="stroke">${esc(event.slice(13,31))}</text></g>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="800" viewBox="0 0 1200 800"><image x="0" y="0" width="1200" height="800" preserveAspectRatio="xMidYMid slice" xlink:href="${esc(imageData)}"/><rect x="0" y="0" width="1200" height="120" fill="#faf7ed" fill-opacity=".82"/><text x="56" y="77" font-family="PingFang SC,Noto Sans CJK SC,sans-serif" font-size="40" font-weight="700" fill="#253138">${esc(title)}</text><g font-family="PingFang SC,Noto Sans CJK SC,sans-serif">${places}${notes}</g></svg>`;
}
export function imageSvgDataUrl(svg:string){return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;}
