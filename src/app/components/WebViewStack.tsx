import React, {
  forwardRef, useImperativeHandle, useRef, useCallback, useState,
} from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import type { Tab, HistoryEntry } from "../types";
import type { Profile } from "../services/profiles";
import type { Injection } from "../services/injections";
import { matchesUrl } from "../services/injections";

// ── Public handle ─────────────────────────────────────────────────────────────

export interface WebViewStackHandle {
  navigate:       (tabId: string, url: string) => void;
  goBack:         (tabId: string) => void;
  goForward:      (tabId: string) => void;
  reload:         (tabId: string) => void;
  stop:           (tabId: string) => void;
  setZoom:        (tabId: string, factor: number) => void;
  setMuted:       (tabId: string, muted: boolean) => void;
  openDevTools:   (tabId: string) => void;
  print:          (tabId: string) => void;
  findInPage:     (tabId: string, text: string, forward?: boolean) => void;
  stopFindInPage: (tabId: string) => void;
  screenshot:     (tabId: string) => Promise<string | null>;
  saveScreenshot: (tabId: string) => Promise<string | null>;
  getWebviewEl:   (tabId: string) => HTMLElement | null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface WebViewStackProps {
  tabs:          Tab[];
  activeTabId:   string;
  /** Extra panel tabIds beyond panel-0 (=activeTabId). Length drives split mode. */
  splitPanels:   string[];
  /** Percentage widths for each panel. Length = splitPanels.length + 1. Sum = 100. */
  panelSizes:    number[];
  onPanelResize: (sizes: number[]) => void;
  onTabUpdate:   (tabId: string, update: Partial<Tab>) => void;
  onHistoryEntry:(entry: Omit<HistoryEntry, 'id'>) => void;
  onFindResult?: (tabId: string, matches: number, active: number) => void;
  /** When true, sets pointer-events:none on all webviews so portal overlays get events. */
  disablePointer?: boolean;
  /** Profile list used to resolve each tab's partition at mount time. */
  profiles?: Profile[];
  /** Ref to the current injections list — read on did-finish-load to avoid stale closures. */
  injectionsRef?: React.RefObject<Injection[]>;
  /** TabId currently owned by PipWindow — its webview gets pip-safe styles. */
  pipTabId?: string;
}

// ── Layout helpers ────────────────────────────────────────────────────────────

const MIN_PANEL_PCT = 14;

function columnStyle(panelIdx: number, sizes: number[]): React.CSSProperties {
  let left = 0;
  for (let i = 0; i < panelIdx; i++) left += sizes[i] ?? 0;
  return {
    position: 'absolute', top: 0, height: '100%',
    left: `${left}%`, width: `${sizes[panelIdx] ?? 0}%`,
  };
}

function gridStyle(panelIdx: number): React.CSSProperties {
  const col = panelIdx % 2;
  const row = Math.floor(panelIdx / 2);
  return {
    position: 'absolute',
    left: `${col * 50}%`, top: `${row * 50}%`,
    width: '50%', height: '50%',
  };
}

// ─────────────────────────────────────────────────────────────────
const IMAGE_HOVER_SCRIPT = `(function(){
  if (window.__w2imgInjected) return;
  window.__w2imgInjected = true;

  const STYLE = document.createElement('style');
  STYLE.textContent = \`
    .__w2img-bar {
      position: fixed;
      z-index: 2147483640;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 5px;
      background: rgba(10,10,12,0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 9px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      pointer-events: auto;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.15s ease, transform 0.15s ease;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .__w2img-bar.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .__w2img-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      height: 26px;
      padding: 0 8px;
      border: none;
      border-radius: 6px;
      background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.82);
      font-size: 11.5px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.1s;
    }
    .__w2img-btn:hover {
      background: rgba(255,255,255,0.14);
      color: #fff;
    }
    .__w2img-btn svg {
      flex-shrink: 0;
    }
    .__w2img-sep {
      width: 1px;
      height: 16px;
      background: rgba(255,255,255,0.1);
      flex-shrink: 0;
    }
    .__w2img-menu {
      position: fixed;
      z-index: 2147483641;
      min-width: 190px;
      background: rgba(14,14,16,0.97);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.72);
      padding: 5px;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .__w2img-menu.open { display: block; }
    .__w2img-mitem {
      display: flex;
      align-items: center;
      gap: 9px;
      height: 32px;
      padding: 0 10px;
      border: none;
      width: 100%;
      background: none;
      color: rgba(255,255,255,0.78);
      font-size: 12.5px;
      text-align: left;
      cursor: pointer;
      border-radius: 7px;
      transition: background 0.08s;
      white-space: nowrap;
    }
    .__w2img-mitem:hover {
      background: rgba(255,255,255,0.07);
      color: #fff;
    }
    .__w2img-mitem.danger:hover {
      background: rgba(239,68,68,0.12);
      color: rgba(239,68,68,0.9);
    }
    .__w2img-msep {
      height: 1px;
      background: rgba(255,255,255,0.07);
      margin: 4px 6px;
    }
    .__w2img-mitem svg { opacity: 0.5; flex-shrink: 0; }
    .__w2img-mitem:hover svg { opacity: 0.8; }
  \`;
  document.head.appendChild(STYLE);

  const svg = (d, vb='0 0 24 24') =>
    \`<svg width="13" height="13" viewBox="\${vb}" fill="none"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="\${d}"/></svg>\`;

  const ICO = {
    copy:    svg('M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2M10 4h4v4H10zM16 8h2a2 2 0 0 1 2 2v2'),
    copyImg: svg('M21 9l-9-7-9 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z M9 22V12h6v10'),
    save:    svg('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3'),
    open:    svg('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3'),
    search:  svg('M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0'),
    google:  svg('M21.8 10.2H12v3.6h5.7C16.8 16 14.7 17.2 12 17.2a6.2 6.2 0 0 1 0-12.4c1.6 0 3 .6 4.1 1.5l2.6-2.6A10.4 10.4 0 0 0 12 1.6C6.3 1.6 1.6 6.3 1.6 12S6.3 22.4 12 22.4c5.4 0 10.1-3.9 10.1-10 0-.7-.1-1.5-.3-2.2z'),
    dots:    svg('M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'),
    link:    svg('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'),
    lens:    svg('M11 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6 M18 2l4 4-9 9H9v-4z'),
    info:    svg('M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M12 8v4 M12 16h.01'),
  };

  const bar  = document.createElement('div');
  bar.className = '__w2img-bar';

  const btnCopy = document.createElement('button');
  btnCopy.className = '__w2img-btn';
  btnCopy.innerHTML = ICO.copyImg + '<span>Copy</span>';

  const sep = document.createElement('div');
  sep.className = '__w2img-sep';

  const btnMore = document.createElement('button');
  btnMore.className = '__w2img-btn';
  btnMore.style.padding = '0 6px';
  btnMore.innerHTML = ICO.dots;
  btnMore.title = 'More options';

  bar.append(btnCopy, sep, btnMore);
  document.body.appendChild(bar);

  const menu = document.createElement('div');
  menu.className = '__w2img-menu';

  function mitem(icon, label, action, danger = false) {
    const b = document.createElement('button');
    b.className = '__w2img-mitem' + (danger ? ' danger' : '');
    b.innerHTML = icon + '<span>' + label + '</span>';
    b.addEventListener('click', (e) => { e.stopPropagation(); action(); hideMenu(); hideBar(); });
    return b;
  }
  function msep() {
    const d = document.createElement('div');
    d.className = '__w2img-msep';
    return d;
  }

  document.body.appendChild(menu);

  let currentSrc = '';
  let currentEl  = null;
  let hideTimer  = null;
  let menuOpen   = false;
  let wcId       = null;

  window.addEventListener('message', (e) => {
    if (e.data && e.data.__w2wcId) wcId = e.data.__w2wcId;
  });
  window.postMessage({ __w2reqWcId: true }, '*');

  function sendAction(action, payload) {
    window.postMessage({ __w2imgAction: action, payload, wcId }, '*');
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function getImageSrc(el) {
    if (el.tagName === 'IMG') return el.src || el.currentSrc || '';
    const bg = window.getComputedStyle(el).backgroundImage;
    const m  = bg.match(/url\\(["']?(.+?)["']?\\)/);
    return m ? m[1] : '';
  }

  function positionBar(rect) {
    const margin = 8;
    const bw = bar.offsetWidth  || 120;
    const bh = bar.offsetHeight || 36;
    let x = rect.right - bw - margin;
    let y = rect.top   + margin;
    if (x < margin) x = rect.left + margin;
    if (y + bh > window.innerHeight) y = rect.bottom - bh - margin;
    bar.style.left = x + 'px';
    bar.style.top  = y + 'px';
  }

  function showBar(el, rect) {
    clearTimeout(hideTimer);
    currentEl  = el;
    currentSrc = getImageSrc(el);
    if (!currentSrc) return;
    positionBar(rect);
    bar.classList.add('visible');
  }

  function hideBar() {
    if (menuOpen) return;
    bar.classList.remove('visible');
    currentEl = null;
  }

  function hideMenu() {
    menu.classList.remove('open');
    menuOpen = false;
  }

  function buildMenu() {
    menu.innerHTML = '';
    const src = currentSrc;
    const el  = currentEl;
    const rect = el ? el.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
    const sx = window.scrollX, sy = window.scrollY;

    menu.append(
      mitem(ICO.copyImg, 'Copy image',        () => sendAction('copyImage',  { x: rect.x + rect.width/2 + sx,  y: rect.y + rect.height/2 + sy })),
      mitem(ICO.copy,    'Copy image URL',    () => copyText(src)),
      mitem(ICO.link,    'Copy link address', () => copyText(src)),
      msep(),
      mitem(ICO.save,    'Save image',        () => sendAction('saveImage', { srcURL: src })),
      mitem(ICO.open,    'Open in new tab',   () => sendAction('openTab',   { url: src })),
      msep(),
      mitem(ICO.google,  'Search image on Google',
        () => sendAction('openTab', { url: 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(src) })),
      msep(),
      mitem(ICO.info,    'View image info',   () => sendAction('openTab',   { url: src })),
    );
  }

  btnCopy.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentEl) return;
    const rect = currentEl.getBoundingClientRect();
    sendAction('copyImage', { x: rect.x + rect.width/2 + window.scrollX, y: rect.y + rect.height/2 + window.scrollY });
    btnCopy.innerHTML = ICO.copyImg + '<span>Copied!</span>';
    setTimeout(() => { btnCopy.innerHTML = ICO.copyImg + '<span>Copy</span>'; }, 1200);
  });

  btnMore.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuOpen) { hideMenu(); return; }
    buildMenu();
    const br = btnMore.getBoundingClientRect();
    menu.style.display = 'block';
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let mx = br.right  - mw;
    let my = br.bottom + 6;
    if (my + mh > window.innerHeight - 8) my = br.top - mh - 6;
    if (mx < 8) mx = 8;
    menu.style.left = mx + 'px';
    menu.style.top  = my + 'px';
    menu.classList.add('open');
    menuOpen = true;
  });

  function isImageEl(el) {
    if (!el || el.tagName === 'BODY' || el.tagName === 'HTML') return false;
    if (el.tagName === 'IMG' && el.src) return true;
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none' && bg.startsWith('url')) {
      const w = el.offsetWidth, h = el.offsetHeight;
      return w > 48 && h > 48;
    }
    return false;
  }

  function findImageEl(el) {
    let cur = el;
    for (let i = 0; i < 3 && cur && cur !== document.body; i++) {
      if (isImageEl(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target;
    if (el === bar || bar.contains(el) || el === menu || menu.contains(el)) return;
    const imgEl = findImageEl(el);
    if (imgEl) showBar(imgEl, imgEl.getBoundingClientRect());
  });

  document.addEventListener('mouseout', (e) => {
    const to = e.relatedTarget;
    if (to === bar || bar.contains(to) || to === menu || menu.contains(to)) return;
    if (to && findImageEl(to)) return;
    hideTimer = setTimeout(hideBar, 300);
  });

  bar.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  bar.addEventListener('mouseleave', () => { if (!menuOpen) hideTimer = setTimeout(hideBar, 300); });

  // capture phase — спрацьовує до будь-якого stopPropagation на сторінці
  document.addEventListener('mousedown', (e) => {
    if (!menu.contains(e.target) && !btnMore.contains(e.target)) hideMenu();
  }, true);

  // клік за межами webview (на React UI браузера) — webview втрачає фокус
  window.addEventListener('blur', () => { hideMenu(); });

  document.addEventListener('scroll', () => { hideMenu(); hideBar(); }, { passive: true });

})();`;
// ─────────────────────────────────────────────────────────────────

// ── Component ─────────────────────────────────────────────────────────────────

export const WebViewStack = forwardRef<WebViewStackHandle, WebViewStackProps>((
  { tabs, activeTabId, splitPanels, panelSizes, onPanelResize,
    onTabUpdate, onHistoryEntry, onFindResult, disablePointer = false,
    profiles = [], injectionsRef, pipTabId },
  ref
) => {
  const webviewRefs        = useRef<Record<string, HTMLElement>>({});
  const initialSrcs        = useRef<Record<string, string>>({});
  const initialPartitions  = useRef<Record<string, string>>({});
  const listenersSet       = useRef<Set<string>>(new Set());
  const containerRef       = useRef<HTMLDivElement>(null);

  const [crashedTabs, setCrashedTabs] = useState<Set<string>>(new Set());

  const allPanels   = [activeTabId, ...splitPanels];
  const totalPanels = allPanels.length;
  const isGrid      = totalPanels === 4;
  const hasSplit    = totalPanels > 1;

  // ── Imperative handle ──────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    navigate: (tabId, url) => {
      initialSrcs.current[tabId] = url;
      const wv = webviewRefs.current[tabId] as any;
      if (!wv) return;
      try { wv.loadURL(url); } catch { wv.src = url; }
      setCrashedTabs(prev => { const s = new Set(prev); s.delete(tabId); return s; });
    },
    goBack: (tabId) => {
      const wv = webviewRefs.current[tabId] as any;
      if (wv?.canGoBack()) wv.goBack();
    },
    goForward: (tabId) => {
      const wv = webviewRefs.current[tabId] as any;
      if (wv?.canGoForward()) wv.goForward();
    },
    reload: (tabId) => {
      const wv = webviewRefs.current[tabId] as any;
      wv?.reload();
      setCrashedTabs(prev => { const s = new Set(prev); s.delete(tabId); return s; });
    },
    stop:  (tabId) => { (webviewRefs.current[tabId] as any)?.stop(); },
    setZoom: (tabId, factor) => {
      const wv = webviewRefs.current[tabId] as any;
      if (!wv) return;
      try {
        const url: string =
          (typeof wv.getURL === 'function' ? wv.getURL() : null) || wv.src || '';
        if (!url || url === 'about:blank') return;
        window.electronAPI?.setWebviewZoom(url, factor);
      } catch {}
    },
    setMuted: (tabId, muted) => {
      const wv = webviewRefs.current[tabId] as any;
      if (!wv) return;
      try { wv.setAudioMuted(muted); } catch {}
      onTabUpdate(tabId, { isMuted: muted });
    },
    openDevTools: (tabId) => {
      const wv = webviewRefs.current[tabId] as any;
      if (!wv) return;
      try {
        const wcId = wv.getWebContentsId?.() as number | undefined;
        if (wcId) window.electronAPI?.openDevTools(wcId);
      } catch {}
    },
    print: (tabId) => {
      try { (webviewRefs.current[tabId] as any)?.print(); } catch {}
    },
    findInPage: (tabId, text, forward = true) => {
      const wv = webviewRefs.current[tabId] as any;
      if (!wv || !text) return;
      try { wv.findInPage(text, { forward }); } catch {}
    },
    stopFindInPage: (tabId) => {
      try { (webviewRefs.current[tabId] as any)?.stopFindInPage('clearSelection'); } catch {}
    },
    screenshot: async (tabId) => {
      const wv = webviewRefs.current[tabId] as any;
      if (!wv) return null;
      try {
        const wcId = wv.getWebContentsId?.() as number | undefined;
        if (!wcId) return null;
        return await window.electronAPI?.screenshot(wcId) ?? null;
      } catch { return null; }
    },
    saveScreenshot: async (tabId) => {
      const wv = webviewRefs.current[tabId] as any;
      if (!wv) return null;
      try {
        const url: string = wv.getURL?.() || '';
        if (!url || url === 'about:blank') return null;
        return await window.electronAPI?.saveScreenshot(url) ?? null;
      } catch { return null; }
    },
    getWebviewEl: (tabId) => webviewRefs.current[tabId] ?? null,
  }));

  // ── Event setup per webview ────────────────────────────────────────────────
  const setupListeners = useCallback((tabId: string, wv: HTMLElement) => {
    if (listenersSet.current.has(tabId)) return;
    listenersSet.current.add(tabId);
    const el = wv as any;

    el.addEventListener('did-start-loading', () => {
      onTabUpdate(tabId, { isLoading: true, isCrashed: false });
    });

    el.addEventListener('did-stop-loading', () => {
      onTabUpdate(tabId, {
        isLoading:    false,
        canGoBack:    el.canGoBack?.()    ?? false,
        canGoForward: el.canGoForward?.() ?? false,
      });
    });

    el.addEventListener('did-navigate', (e: any) => {
      const url: string = e.url || '';
      if (!url || url === 'about:blank') return;
      onTabUpdate(tabId, {
        url,
        canGoBack:    el.canGoBack?.()    ?? false,
        canGoForward: el.canGoForward?.() ?? false,
      });
      onHistoryEntry({
        url, title: el.getTitle?.() || url,
        favicon: undefined, visitedAt: Date.now(),
      });
    });

    el.addEventListener('did-navigate-in-page', (e: any) => {
      if (!e.isMainFrame) return;
      const url: string = e.url || '';
      if (!url || url === 'about:blank') return;
      onTabUpdate(tabId, {
        url,
        canGoBack:    el.canGoBack?.()    ?? false,
        canGoForward: el.canGoForward?.() ?? false,
      });
    });

    el.addEventListener('page-title-updated',   (e: any) => { if (e.title) onTabUpdate(tabId, { title: e.title }); });
    el.addEventListener('page-favicon-updated',  (e: any) => { const f = e.favicons?.[0]; if (f) onTabUpdate(tabId, { favicon: f }); });

    el.addEventListener('media-started-playing', () => { onTabUpdate(tabId, { isAudible: true }); });
    el.addEventListener('media-paused',           () => { onTabUpdate(tabId, { isAudible: false }); });

    el.addEventListener('did-finish-load', () => {
      const url: string = el.getURL?.() || '';
      if (!url || url === 'about:blank') return;
      const injs = injectionsRef?.current ?? [];
      for (const inj of injs) {
        if (!inj.enabled || !matchesUrl(inj.urlPattern, url)) continue;
        if (inj.css) el.insertCSS(inj.css).catch(() => {});
        if (inj.js)  el.executeJavaScript(inj.js).catch(() => {});
      }
      // Image hover overlay
      el.executeJavaScript(IMAGE_HOVER_SCRIPT).catch(() => {});
    });

    el.addEventListener('did-fail-load', (e: any) => {
      if (e.errorCode === -3) return;
      onTabUpdate(tabId, { isLoading: false, title: 'Failed to load' });
    });

    el.addEventListener('crashed', () => {
      setCrashedTabs(prev => new Set([...prev, tabId]));
      onTabUpdate(tabId, { isLoading: false, isCrashed: true, title: 'Tab crashed' });
    });

    el.addEventListener('found-in-page', (e: any) => {
      if (e.result && onFindResult) {
        onFindResult(tabId, e.result.matches ?? 0, e.result.activeMatchOrdinal ?? 1);
      }
    });
  }, [onTabUpdate, onHistoryEntry, onFindResult]);

  // ── Divider drag (column layouts only) ────────────────────────────────────
  const handleDividerDown = useCallback((divIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container || isGrid) return;

    const startX     = e.clientX;
    const totalW     = container.offsetWidth;
    const startSizes = [...panelSizes];

    const onMove = (me: MouseEvent) => {
      const dPct   = ((me.clientX - startX) / totalW) * 100;
      const pool   = startSizes[divIdx] + startSizes[divIdx + 1];
      const left   = Math.max(MIN_PANEL_PCT, Math.min(pool - MIN_PANEL_PCT, startSizes[divIdx] + dPct));
      const next   = [...startSizes];
      next[divIdx]     = left;
      next[divIdx + 1] = pool - left;
      onPanelResize(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelSizes, onPanelResize, isGrid]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const externalTabs = tabs.filter(t => !t.url.startsWith('web20://'));

  return (
    <div
      id="webview-stack-container"
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {externalTabs.map(tab => {
        if (!initialSrcs.current[tab.id]) {
          initialSrcs.current[tab.id] = tab.url;
        }
        // Lock partition at first mount — immutable on webview after creation.
        if (!(tab.id in initialPartitions.current)) {
          const profile = profiles.find(p => p.id === (tab.profileId || 'default'));
          initialPartitions.current[tab.id] = profile?.partition ?? '';
        }
        const tabPartition = initialPartitions.current[tab.id];

        const panelIdx = allPanels.indexOf(tab.id);
        const inPanel  = panelIdx >= 0;

        const activePtr: React.CSSProperties['pointerEvents'] = disablePointer ? 'none' : 'auto';

        let baseStyle: React.CSSProperties;
        if (tab.id === pipTabId) {
          // PipWindow owns this element — must match what PipWindow sets so React doesn't fight it
          baseStyle = { position: 'absolute', inset: 0, visibility: 'visible', pointerEvents: 'auto' };
        } else if (!inPanel) {
          baseStyle = { position: 'absolute', inset: 0, visibility: 'hidden', pointerEvents: 'none' };
        } else if (isGrid) {
          baseStyle = { ...gridStyle(panelIdx), visibility: 'visible', pointerEvents: activePtr };
        } else {
          baseStyle = { ...columnStyle(panelIdx, panelSizes), visibility: 'visible', pointerEvents: activePtr };
        }

        const isCrashed = crashedTabs.has(tab.id);

        return (
          <React.Fragment key={tab.id}>
            <webview
              src={initialSrcs.current[tab.id]}
              partition={tabPartition || undefined}
              allowpopups=""
              ref={(el: HTMLElement | null) => {
                if (!el) {
                  delete webviewRefs.current[tab.id];
                  delete initialSrcs.current[tab.id];
                  delete initialPartitions.current[tab.id];
                  listenersSet.current.delete(tab.id);
                  return;
                }
                webviewRefs.current[tab.id] = el;
                setupListeners(tab.id, el);
              }}
              style={baseStyle}
            />

            {/* Crashed overlay */}
            {isCrashed && inPanel && (
              <div
                style={{
                  ...baseStyle,
                  visibility: 'visible',
                  pointerEvents: 'auto',
                  zIndex: 8,
                  background: '#0B0B0C',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertTriangle size={22} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.28)' }} />
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>This page crashed</span>
                <button
                  onClick={() => {
                    setCrashedTabs(prev => { const s = new Set(prev); s.delete(tab.id); return s; });
                    (webviewRefs.current[tab.id] as any)?.reload();
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 18px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.055)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.72)',
                    fontSize: 12.5, cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={12} />
                  Reload page
                </button>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* ── Resize dividers (column layouts only) ─────────────────────── */}
      {hasSplit && !isGrid && panelSizes.slice(0, -1).map((_, i) => {
        let leftPct = 0;
        for (let j = 0; j <= i; j++) leftPct += panelSizes[j] ?? 0;
        return (
          <div
            key={`d-${i}`}
            onMouseDown={(e) => handleDividerDown(i, e)}
            style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `calc(${leftPct}% - 4px)`,
              width: 8,
              cursor: 'col-resize',
              zIndex: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <div style={{
              width: 1, height: '100%',
              background: 'rgba(255,255,255,0.09)',
              transition: 'background 0.15s',
            }} />
          </div>
        );
      })}

      {/* ── 4-grid static dividers ─────────────────────────────────────── */}
      {isGrid && (
        <>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%',
            width: 1, background: 'rgba(255,255,255,0.09)', zIndex: 20, pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '50%',
            height: 1, background: 'rgba(255,255,255,0.09)', zIndex: 20, pointerEvents: 'none',
          }} />
        </>
      )}
    </div>
  );
});

WebViewStack.displayName = 'WebViewStack';
