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

// ── Component ─────────────────────────────────────────────────────────────────

export const WebViewStack = forwardRef<WebViewStackHandle, WebViewStackProps>((
  { tabs, activeTabId, splitPanels, panelSizes, onPanelResize,
    onTabUpdate, onHistoryEntry, onFindResult, disablePointer = false,
    profiles = [], injectionsRef },
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
        if (!inPanel) {
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
