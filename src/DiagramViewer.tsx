import { useEffect } from 'react';
import { X } from 'lucide-react';

function isSvgDataUrl(src: string): boolean { return src.startsWith('data:image/svg+xml'); }
function decodeSvg(src: string): string {
  const comma = src.indexOf(',');
  const encoded = src.slice(comma + 1);
  try { return decodeURIComponent(encoded); } catch { return encoded; }
}

export function DiagramViewer({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  const svg = isSvgDataUrl(src) ? decodeSvg(src) : '';
  return <div className="modal-backdrop" onClick={onClose}><div className="diagram-modal" onClick={event => event.stopPropagation()}><div className="panel-heading"><h3>{title}</h3><button className="icon-button" aria-label="关闭大图" onClick={onClose}><X size={19} /></button></div>{svg ? <div className="diagram-svg-inline" dangerouslySetInnerHTML={{ __html: svg }} /> : <img src={src} alt={title} />}<a className="button" href={src} download={`${title}.svg`}>下载图片</a></div></div>;
}
