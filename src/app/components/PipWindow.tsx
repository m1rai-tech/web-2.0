import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2 } from 'lucide-react';

interface PipWindowProps {
  tabId:       string;
  tabTitle:    string;
  tabFavicon?: string;
  webviewEl:   HTMLElement | null;
  onClose:     () => void;
  onExpand:    () => void;
}

const DEFAULT_W   = 480;
const DEFAULT_H   = 270; // 16:9
const MIN_W       = 240;
const MIN_H       = 135;
const MAX_W       = 1200;
const MAX_H       = 720;
const SNAP_MARGIN = 16;

// Injected into the webview page to isolate the video over a black backdrop.
// Finds the largest/playing video, moves it to the document root above a black
// overlay, so the rest of the page is hidden. Stores cleanup on document.__w2PipCleanup.
const PIP_ISOLATE_SCRIPT = `(function(){
  if(document.__w2PipCleanup) document.__w2PipCleanup();

  // Pick the best video: largest area, prefer currently playing
  var videos = Array.from(document.querySelectorAll('video'));
  if(!videos.length) return;
  var v = videos.reduce(function(best, cur){
    var cs = cur.offsetWidth * cur.offsetHeight + (cur.paused ? 0 : 100000);
    var bs = best.offsetWidth * best.offsetHeight + (best.paused ? 0 : 100000);
    return cs > bs ? cur : best;
  });
  if(!v) return;

  // Black backdrop covers all page content
  var bd = document.createElement('div');
  bd.id = '__w2pip_bd';
  bd.style.cssText = 'position:fixed;inset:0;background:#000;z-index:2147483645;pointer-events:none;';
  document.documentElement.appendChild(bd);

  // Save video's original position in DOM
  var vParent = v.parentElement;
  var vNext   = v.nextSibling;
  var vStyle  = v.getAttribute('style') || '';

  // Elevate video above backdrop
  document.documentElement.appendChild(v);
  v.style.cssText = [
    'position:fixed', 'inset:0', 'width:100vw', 'height:100vh',
    'z-index:2147483647', 'object-fit:contain', 'background:#000',
    'margin:0', 'padding:0', 'display:block',
  ].join('!important;') + '!important;';

  document.__w2PipCleanup = function(){
    var b = document.getElementById('__w2pip_bd');
    if(b) b.parentNode.removeChild(b);
    if(vParent){
      if(vNext) vParent.insertBefore(v, vNext);
      else      vParent.appendChild(v);
    }
    if(vStyle) v.setAttribute('style', vStyle);
    else       v.removeAttribute('style');
    delete document.__w2PipCleanup;
  };
})()`;

const PIP_CLEANUP_SCRIPT = `if(document.__w2PipCleanup) document.__w2PipCleanup()`;

export function PipWindow({ tabId, tabTitle, tabFavicon, webviewEl, onClose, onExpand }: PipWindowProps) {
  const [pos,  setPos]  = useState({
    x: window.innerWidth  - DEFAULT_W - SNAP_MARGIN,
    y: window.innerHeight - DEFAULT_H - SNAP_MARGIN - 48,
  });
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [isHovered, setIsHovered] = useState(false);

  const mountRef  = useRef<HTMLDivElement>(null);
  const dragRef   = useRef<{ startX: number; startY: number; startPX: number; startPY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startPX: number; startPY: number; corner: string } | null>(null);

  // Move webview into PipWindow's mount — useLayoutEffect so cleanup runs BEFORE
  // React removes PipWindow's DOM, guaranteeing the webview is re-attached to the
  // live document before any executeJavaScript calls happen in the effect below.
  useLayoutEffect(() => {
    if (!webviewEl || !mountRef.current) return;
    const mount     = mountRef.current;
    const origStyle = webviewEl.getAttribute('style') || '';

    mount.appendChild(webviewEl);
    webviewEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;visibility:visible;pointer-events:auto;';

    return () => {
      const container = document.getElementById('webview-stack-container');
      if (container && webviewEl.parentElement === mount) {
        container.appendChild(webviewEl);
        webviewEl.setAttribute('style', origStyle);
      }
    };
  }, [webviewEl]);

  // Inject / clean up the video-isolation script — runs after layout so the webview
  // is already mounted and re-attached (by the layout effect above) before any call.
  useEffect(() => {
    if (!webviewEl) return;
    const wv = webviewEl as any;

    const t = setTimeout(() => {
      wv.executeJavaScript?.(PIP_ISOLATE_SCRIPT).catch(() => {});
    }, 80);

    return () => {
      clearTimeout(t);
      wv.executeJavaScript?.(PIP_CLEANUP_SCRIPT).catch(() => {});
    };
  }, [webviewEl]);

  // ── Drag ─────────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPX: pos.x, startPY: pos.y };
    const sw = size.w, sh = size.h;

    const onMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const nx = dragRef.current.startPX + (me.clientX - dragRef.current.startX);
      const ny = dragRef.current.startPY + (me.clientY - dragRef.current.startY);
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - sw, nx)),
        y: Math.max(0, Math.min(window.innerHeight - sh, ny)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [pos, size.w, size.h]);

  // ── Resize ───────────────────────────────────────────────────────────────────
  const handleResizeStart = useCallback((corner: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      startW: size.w,    startH: size.h,
      startPX: pos.x,    startPY: pos.y,
      corner,
    };

    const onMove = (me: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dx = me.clientX - r.startX;
      const dy = me.clientY - r.startY;
      const c  = r.corner;
      let newW = r.startW, newH = r.startH, newX = r.startPX, newY = r.startPY;

      if (c.includes('e')) newW = Math.max(MIN_W, Math.min(MAX_W, r.startW + dx));
      if (c.includes('s')) newH = Math.max(MIN_H, Math.min(MAX_H, r.startH + dy));
      if (c.includes('w')) { newW = Math.max(MIN_W, Math.min(MAX_W, r.startW - dx)); newX = r.startPX + r.startW - newW; }
      if (c.includes('n')) { newH = Math.max(MIN_H, Math.min(MAX_H, r.startH - dy)); newY = r.startPY + r.startH - newH; }

      setSize({ w: newW, h: newH });
      setPos({ x: newX, y: newY });
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [size, pos]);

  // ── Resize handle positions ──────────────────────────────────────────────────
  const cursors: Record<string, string> = {
    se: 'nwse-resize', sw: 'nesw-resize', ne: 'nesw-resize', nw: 'nwse-resize',
    e:  'ew-resize',   w:  'ew-resize',   s:  'ns-resize',   n:  'ns-resize',
  };
  const handlePos: Record<string, React.CSSProperties> = {
    se: { bottom: 0,    right:  0,    width: 18, height: 18 },
    sw: { bottom: 0,    left:   0,    width: 18, height: 18 },
    ne: { top:    0,    right:  0,    width: 18, height: 18 },
    nw: { top:    0,    left:   0,    width: 18, height: 18 },
    e:  { top: '20%',  right:  0,    width:  6, height: '60%' },
    w:  { top: '20%',  left:   0,    width:  6, height: '60%' },
    s:  { bottom: 0,   left: '20%',  width: '60%', height: 6 },
    n:  { top:    0,   left: '20%',  width: '60%', height: 6 },
  };

  return createPortal(
    <div
      style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: 9100 }}
      className="rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.85)] border border-white/[0.1]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Real webview lives here — video is isolated inside it by the injected script */}
      <div ref={mountRef} style={{ position: 'absolute', inset: 0, background: '#000' }} />

      {/* Resize handles — rendered above webview */}
      {Object.keys(cursors).map(corner => (
        <div
          key={corner}
          style={{ position: 'absolute', cursor: cursors[corner], zIndex: 30, ...handlePos[corner] }}
          onMouseDown={(e) => handleResizeStart(corner, e)}
        />
      ))}

      {/* Top control bar */}
      <div
        className={`absolute inset-x-0 top-0 flex items-center gap-1.5 px-2.5 py-2
          bg-gradient-to-b from-black/80 to-transparent
          transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        style={{ zIndex: 40, pointerEvents: isHovered ? 'auto' : 'none' }}
      >
        {/* Drag zone */}
        <div
          className="flex-1 flex items-center gap-2 cursor-grab active:cursor-grabbing min-w-0"
          onMouseDown={handleDragStart}
        >
          {tabFavicon && <img src={tabFavicon} className="w-3.5 h-3.5 rounded-sm shrink-0" alt="" />}
          <span className="text-[11px] text-white/70 truncate select-none">{tabTitle}</span>
        </div>

        <button
          onClick={onExpand}
          title="Expand to tab"
          className="w-6 h-6 rounded-md flex items-center justify-center
            text-white/50 hover:text-white/90 hover:bg-white/[0.15]
            transition-all duration-150 cursor-pointer shrink-0"
        >
          <Maximize2 size={11} strokeWidth={2} />
        </button>

        <button
          onClick={onClose}
          title="Close PiP"
          className="w-6 h-6 rounded-md flex items-center justify-center
            text-white/50 hover:text-red-400/80 hover:bg-white/[0.15]
            transition-all duration-150 cursor-pointer shrink-0"
        >
          <X size={11} strokeWidth={2} />
        </button>
      </div>

      {/* Bottom size indicator */}
      <div
        className={`absolute inset-x-0 bottom-0 flex items-center justify-center
          bg-gradient-to-t from-black/70 to-transparent py-1.5
          transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        style={{ zIndex: 40, pointerEvents: 'none' }}
      >
        <span className="text-[9px] text-white/35 select-none tracking-wide">
          {Math.round(size.w)} × {Math.round(size.h)}
        </span>
      </div>
    </div>,
    document.body
  );
}
