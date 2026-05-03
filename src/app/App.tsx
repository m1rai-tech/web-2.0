import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { TopBar }           from "./components/TopBar";
import { Menus }            from "./components/Menus";
import { SiteManager }      from "./components/SiteManager";
import { FindBar }          from "./components/FindBar";
import { WebViewStack, WebViewStackHandle } from "./components/WebViewStack";
import { InternalPages }    from "./components/InternalPages";
import { StickyAppsBar, StickyAppsLayer } from "./components/StickyAppsBar";
import { TabSwitcher }      from "./components/TabSwitcher";
import type { Tab, Site, HistoryEntry, Bookmark, DownloadItem } from "./types";
import { loadStorage, saveStorage } from "./services/storage";
import { addHistoryEntry, getHistory, clearHistory } from "./services/history";
import { getBookmarks, addBookmark, removeBookmark, clearBookmarks } from "./services/bookmarks";
import { getDownloads, saveDownload, clearDownloads } from "./services/downloads";
import { scheduleSessionSave, flushSessionSave, loadSession } from "./services/session";
import { STICKY_APPS } from "./services/stickyApps";
import { getCustomApps, addCustomApp, removeCustomApp } from "./services/customApps";
import { getPinnedActions, savePinnedActions } from "./services/pinnableActions";
import type { PinnableId } from "./services/pinnableActions";
import { getProfiles, saveProfiles, getActiveProfileId, saveActiveProfileId } from "./services/profiles";
import type { Profile } from "./services/profiles";
import { getInjections, saveInjections } from "./services/injections";
import type { Injection } from "./services/injections";
import { Toast } from "./components/Toast";
import { PinnedPopup } from "./components/PinnedPopup";
import { ContextMenu } from "./components/ContextMenu";

// ── Constants ─────────────────────────────────────────────────────────────────

const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

const DEFAULT_SITES: Site[] = [
  { id: "yt", name: "YouTube",  url: "youtube.com",  color: "#FF3B3B" },
  { id: "fg", name: "Figma",    url: "figma.com",    color: "#A259FF" },
  { id: "gh", name: "GitHub",   url: "github.com",   color: "#E0E0E0" },
  { id: "go", name: "Google",   url: "google.com",   color: "#5B8DEF" },
  { id: "ai", name: "ChatGPT",  url: "chatgpt.com",  color: "#10A37F" },
];

const ACCENT_PALETTE = [
  "#FF3B3B","#A259FF","#5B8DEF","#10A37F","#FF9F0A",
  "#30D158","#64D2FF","#FF6B6B","#C084FC","#34D399",
];

function equalSizes(count: number): number[] {
  if (count <= 1) return [100];
  const base = Math.floor(100 / count);
  const sizes = Array(count).fill(base);
  sizes[sizes.length - 1] += 100 - base * count; // absorb rounding
  return sizes;
}

// ── URL helpers ───────────────────────────────────────────────────────────────

function resolveUrl(input: string): string {
  const v = input.trim();
  if (!v) return 'web20://start';
  if (v.startsWith('web20://'))   return v;
  if (v.startsWith('view-source:')) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})([\/?#]|$)/.test(v)) return 'https://' + v;
  const engine = (() => {
    try { return localStorage.getItem('w2_searchEngine') || 'google'; } catch { return 'google'; }
  })();
  if (engine === 'duckduckgo') return `https://duckduckgo.com/?q=${encodeURIComponent(v)}`;
  if (engine === 'bing')       return `https://www.bing.com/search?q=${encodeURIComponent(v)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(v)}`;
}

function getInternalTitle(url: string): string {
  const page = url.replace('web20://', '');
  const map: Record<string, string> = {
    start: 'New Tab', history: 'History',
    bookmarks: 'Bookmarks', downloads: 'Downloads',
    settings: 'Settings', extensions: 'Extensions',
    profiles: 'Profiles', injections: 'Injections',
  };
  return map[page] ?? 'New Tab';
}

function normalizeTabs(raw: unknown[]): Tab[] {
  return raw.map((t: any) => ({
    id:        t.id       || String(Date.now()),
    title:     t.title    || 'New Tab',
    favicon:   t.favicon,
    url:       t.url      || 'web20://start',
    profileId: t.profileId,
  }));
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Private mode (detected once) ──────────────────────────────────────────
  const isPrivate = useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('private') === '1'; }
    catch { return false; }
  }, []);

  // ── Session restore ────────────────────────────────────────────────────────
  const restoredSession = useMemo(() => {
    if (isPrivate) return null;
    return loadSession();
  }, [isPrivate]);

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<Tab[]>(() => {
    if (isPrivate) return [{ id: '1', title: 'New Tab', url: 'web20://start' }];
    if (restoredSession?.tabs?.length) return normalizeTabs(restoredSession.tabs);
    const raw    = loadStorage<unknown[]>('w2_tabs', []);
    const stored = Array.isArray(raw) ? normalizeTabs(raw) : [];
    return stored.length > 0 ? stored : [{ id: '1', title: 'New Tab', url: 'web20://start' }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (restoredSession?.activeTabId) return restoredSession.activeTabId;
    return tabs[0]?.id ?? '1';
  });

  // Keep activeTabId valid when tabs change
  useEffect(() => {
    if (!tabs.find(t => t.id === activeTabId)) {
      setActiveTabId(tabs[tabs.length - 1]?.id ?? '');
    }
  }, [tabs, activeTabId]);

  const activeTab    = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  const currentUrl   = activeTab?.url ?? 'web20://start';
  const isInternal   = currentUrl.startsWith('web20://');
  const internalPage = currentUrl.replace('web20://', '') || 'start';

  // ── Split panels ───────────────────────────────────────────────────────────
  const [splitPanels, setSplitPanels] = useState<string[]>(() =>
    restoredSession?.splitPanels ?? []
  );
  const [panelSizes, setPanelSizes] = useState<number[]>(() =>
    restoredSession?.panelSizes ?? [100]
  );

  // Remove split panels whose tabs no longer exist
  useEffect(() => {
    const valid = splitPanels.filter(id => tabs.find(t => t.id === id));
    if (valid.length !== splitPanels.length) {
      setSplitPanels(valid);
      setPanelSizes(equalSizes(1 + valid.length));
    }
  }, [tabs]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPanels = 1 + splitPanels.length;

  // ── Sites ──────────────────────────────────────────────────────────────────
  const [sites, setSites] = useState<Site[]>(() => {
    const raw = loadStorage<unknown[]>('w2_sites', DEFAULT_SITES);
    return Array.isArray(raw) && raw.length > 0 ? (raw as Site[]) : DEFAULT_SITES;
  });
  useEffect(() => { saveStorage('w2_sites', sites); }, [sites]);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [history,   setHistory]   = useState<HistoryEntry[]>(getHistory);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(getBookmarks);
  const [downloads, setDownloads] = useState<DownloadItem[]>(getDownloads);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const webViewRef    = useRef<WebViewStackHandle>(null);
  const addressBarRef = useRef<HTMLInputElement>(null);
  const topBarRef     = useRef<HTMLDivElement>(null);

  // Pixel offset from viewport top where the menu panel should appear (below TopBar)
  const [menuTop, setMenuTop] = useState(88);
  useEffect(() => {
    const update = () => {
      if (topBarRef.current) {
        const r = topBarRef.current.getBoundingClientRect();
        setMenuTop(Math.round(r.bottom) + 2);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [openMenu,        setOpenMenu]        = useState<string | null>(null);
  const [siteManagerOpen, setSiteManagerOpen] = useState(false);
  const [activeStickyApp, setActiveStickyApp] = useState<string | null>(null);
  const [tabSwitcherOpen, setTabSwitcherOpen] = useState(false);
  const [tabSwitcherDir,  setTabSwitcherDir]  = useState<1 | -1>(1);

  // ── Per-tab navigation log (for back-button history dropdown) ─────────────
  const [tabNavLogs, setTabNavLogs] = useState<Record<string, string[]>>({});

  // ── Zoom (per-tab) ─────────────────────────────────────────────────────────
  const [tabZooms, setTabZooms] = useState<Record<string, number>>({});
  const currentZoom = tabZooms[activeTabId] ?? 1;

  useEffect(() => {
    if (!isElectron) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || tab.url.startsWith('web20://')) return;
    const factor = tabZooms[activeTabId] ?? 1;
    webViewRef.current?.setZoom(activeTabId, factor);
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Find in page ───────────────────────────────────────────────────────────
  const [findBarOpen,  setFindBarOpen]  = useState(false);
  const [findMatches,  setFindMatches]  = useState<{ matches: number; active: number } | null>(null);

  // ── Toast notification ─────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);

  // ── Pinned toolbar items ───────────────────────────────────────────────────
  const [pinnedItems, setPinnedItems] = useState<PinnableId[]>(getPinnedActions);

  const handleTogglePin = useCallback((id: PinnableId) => {
    setPinnedItems(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      savePinnedActions(next);
      return next;
    });
  }, []);

  const [pinnedPopup, setPinnedPopup] = useState<{ id: PinnableId; anchor: DOMRect } | null>(null);

  // ── Context menu ───────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuParams | null>(null);

  // ── Profiles ───────────────────────────────────────────────────────────────
  const [profiles,         setProfiles]         = useState<Profile[]>(getProfiles);
  const [activeProfileId,  setActiveProfileId]  = useState<string>(getActiveProfileId);

  const handleSwitchProfile = useCallback((id: string) => {
    setActiveProfileId(id);
    saveActiveProfileId(id);
  }, []);

  const handleProfilesChange = useCallback((p: Profile[]) => {
    setProfiles(p);
    saveProfiles(p);
  }, []);

  // ── CSS / JS Injections ────────────────────────────────────────────────────
  const [injections, setInjections] = useState<Injection[]>(getInjections);
  const injectionsRef = useRef<Injection[]>(injections);
  useEffect(() => { injectionsRef.current = injections; }, [injections]);

  const handleInjectionsChange = useCallback((list: Injection[]) => {
    setInjections(list);
    saveInjections(list);
  }, []);

  useEffect(() => {
    setFindBarOpen(false);
    setFindMatches(null);
  }, [activeTabId]);

  // ── Session auto-save ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isPrivate) return;
    scheduleSessionSave({
      tabs: tabs.map(({ id, title, favicon, url }) => ({ id, title, favicon, url })),
      activeTabId,
      splitPanels,
      panelSizes,
    });
  }, [tabs, activeTabId, splitPanels, panelSizes, isPrivate]);

  // Flush on unmount / window close
  useEffect(() => {
    if (isPrivate) return;
    const flush = () => flushSessionSave({
      tabs: tabs.map(({ id, title, favicon, url }) => ({ id, title, favicon, url })),
      activeTabId,
      splitPanels,
      panelSizes,
    });
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [tabs, activeTabId, splitPanels, panelSizes, isPrivate]);

  // ── Navigate ───────────────────────────────────────────────────────────────
  const navigate = useCallback((input: string) => {
    const url   = resolveUrl(input);
    const tabId = activeTabId;
    setFindBarOpen(false);
    setFindMatches(null);
    if (!isInternal) webViewRef.current?.stopFindInPage(tabId);
    if (url.startsWith('web20://')) {
      setTabs(prev => prev.map(t =>
        t.id === tabId
          ? { ...t, url, title: getInternalTitle(url), isLoading: false, canGoBack: false, canGoForward: false }
          : t
      ));
    } else {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, url, isLoading: true } : t));
      if (isElectron) setTimeout(() => webViewRef.current?.navigate(tabId, url), 0);
    }
    setOpenMenu(null);
  }, [activeTabId, isInternal]);

  // ── Tab update callback ────────────────────────────────────────────────────
  const handleTabUpdate = useCallback((tabId: string, update: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...update } : t));
    if (update.url) {
      setTabNavLogs(prev => ({
        ...prev,
        [tabId]: [...(prev[tabId] ?? []).slice(-19), update.url!],
      }));
    }
  }, []);

  // ── History ────────────────────────────────────────────────────────────────
  const handleHistoryEntry = useCallback((entry: Omit<HistoryEntry, 'id'>) => {
    if (isPrivate) return;
    const newEntry = addHistoryEntry(entry);
    setHistory(prev => [newEntry, ...prev.filter(h => h.id !== newEntry.id)].slice(0, 1000));
  }, [isPrivate]);

  // ── Find result ────────────────────────────────────────────────────────────
  const handleFindResult = useCallback((tabId: string, matches: number, active: number) => {
    if (tabId === activeTabId) setFindMatches({ matches, active });
  }, [activeTabId]);

  // ── Tab management ─────────────────────────────────────────────────────────
  const handleNewTab = useCallback(() => {
    const id = String(Date.now());
    setTabs(prev => [...prev, { id, title: 'New Tab', url: 'web20://start', profileId: activeProfileId }]);
    setActiveTabId(id);
    setTimeout(() => { addressBarRef.current?.focus(); addressBarRef.current?.select(); }, 60);
  }, [activeProfileId]);

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      return next.length === 0 ? [{ id: String(Date.now()), title: 'New Tab', url: 'web20://start' }] : next;
    });
    // Remove from split if needed
    setSplitPanels(prev => {
      const next = prev.filter(id => id !== tabId);
      if (next.length !== prev.length) setPanelSizes(equalSizes(1 + next.length));
      return next;
    });
  }, []);

  const handleOpenInNewTab = useCallback((url: string) => {
    const resolved = resolveUrl(url);
    const id = String(Date.now());
    setTabs(prev => [...prev, { id, title: 'New Tab', url: resolved, profileId: activeProfileId }]);
    setActiveTabId(id);
  }, [activeProfileId]);

  const handleGoHome = useCallback(() => {
    navigate('web20://start');
    setSiteManagerOpen(false);
  }, [navigate]);

  const handlePinTab = useCallback((id: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, isPinned: !t.isPinned } : t));
  }, []);

  // ── Navigation controls ────────────────────────────────────────────────────
  const handleBack    = useCallback(() => { if (isElectron && !isInternal) webViewRef.current?.goBack(activeTabId);    }, [activeTabId, isInternal]);
  const handleForward = useCallback(() => { if (isElectron && !isInternal) webViewRef.current?.goForward(activeTabId); }, [activeTabId, isInternal]);
  const handleReload  = useCallback(() => { if (isElectron && !isInternal) webViewRef.current?.reload(activeTabId);    }, [activeTabId, isInternal]);
  const handleStop    = useCallback(() => {
    if (isElectron && !isInternal) webViewRef.current?.stop(activeTabId);
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isLoading: false } : t));
  }, [activeTabId, isInternal]);

  // ── Zoom ───────────────────────────────────────────────────────────────────
  const applyZoom = useCallback((tabId: string, factor: number) => {
    setTabZooms(prev => ({ ...prev, [tabId]: factor }));
    webViewRef.current?.setZoom(tabId, factor);
  }, []);
  const handleZoomIn    = useCallback(() => { if (!isInternal) applyZoom(activeTabId, Math.min(3,    (tabZooms[activeTabId] ?? 1) + 0.25)); }, [activeTabId, tabZooms, isInternal, applyZoom]);
  const handleZoomOut   = useCallback(() => { if (!isInternal) applyZoom(activeTabId, Math.max(0.25, (tabZooms[activeTabId] ?? 1) - 0.25)); }, [activeTabId, tabZooms, isInternal, applyZoom]);
  const handleResetZoom = useCallback(() => { if (!isInternal) applyZoom(activeTabId, 1); }, [activeTabId, isInternal, applyZoom]);

  // ── Print / Screenshot / Find ──────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (isInternal) { window.print(); return; }
    if (isElectron) webViewRef.current?.print(activeTabId);
  }, [activeTabId, isInternal]);

  const handleScreenshot = useCallback(async () => {
    if (!isElectron) return;
    // Internal pages (React content, no webview) → capture the BrowserWindow.
    // External pages (webview) → find webContents by URL and capture.
    const filePath = isInternal
      ? await window.electronAPI?.captureWindow()
      : await window.electronAPI?.saveScreenshot(currentUrl);
    if (filePath) {
      const fname = filePath.split(/[\\/]/).pop() ?? 'screenshot.png';
      setToast(`Screenshot saved: ${fname}`);
    }
  }, [currentUrl, isInternal]);

  const handleFindInPage = useCallback(() => { if (!isInternal) setFindBarOpen(true); }, [isInternal]);

  // ── Tab mute ───────────────────────────────────────────────────────────────
  const handleMuteTab = useCallback((tabId: string, muted: boolean) => {
    webViewRef.current?.setMuted(tabId, muted);
  }, []);

  // ── Real downloads ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isElectron) return;

    const unsubStart = window.electronAPI?.onDownloadStart?.((d) => {
      setDownloads(prev => [{
        id: d.id, filename: d.filename, url: d.url,
        size: d.totalBytes || undefined, receivedBytes: 0,
        state: 'progressing', savedAt: Date.now(),
      }, ...prev]);
    });

    const unsubUpdate = window.electronAPI?.onDownloadUpdate?.((d) => {
      setDownloads(prev => prev.map(item =>
        item.id === d.id
          ? { ...item, receivedBytes: d.receivedBytes, size: d.totalBytes || item.size }
          : item
      ));
    });

    const unsubDone = window.electronAPI?.onDownloadDone?.((d) => {
      setDownloads(prev => {
        const next = prev.map(item =>
          item.id === d.id ? { ...item, state: d.state as DownloadItem['state'] } : item
        );
        const finished = next.find(i => i.id === d.id);
        if (finished && finished.state !== 'progressing') saveDownload(finished);
        return next;
      });
      if (d.state === 'completed') setToast(`Downloaded: ${d.filename}`);
    });

    return () => { unsubStart?.(); unsubUpdate?.(); unsubDone?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Context menu IPC ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isElectron) return;
    const unsub = window.electronAPI?.onContextMenu?.((p) => setContextMenu(p));
    return () => unsub?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePinnedAction = useCallback((id: PinnableId, anchor: DOMRect) => {
    switch (id) {
      case 'screenshot': handleScreenshot(); break;
      case 'find':       handleFindInPage(); break;
      case 'print':      handlePrint();      break;
      default:
        // navigation-type buttons → show mini popup
        setPinnedPopup({ id, anchor });
    }
  }, [handleScreenshot, handleFindInPage, handlePrint]);

  const handleFindSubmit = useCallback((text: string, forward = true) => {
    if (!text) { webViewRef.current?.stopFindInPage(activeTabId); setFindMatches(null); return; }
    webViewRef.current?.findInPage(activeTabId, text, forward);
  }, [activeTabId]);

  const handleFindClose = useCallback(() => {
    setFindBarOpen(false);
    setFindMatches(null);
    webViewRef.current?.stopFindInPage(activeTabId);
  }, [activeTabId]);

  // ── New windows ────────────────────────────────────────────────────────────
  const handleNewWindow        = useCallback(() => { window.electronAPI?.newWindow(); }, []);
  const handleNewPrivateWindow = useCallback(() => { window.electronAPI?.newPrivateWindow(); }, []);

  // ── Split screen ───────────────────────────────────────────────────────────
  const handleSetSplitMode = useCallback((count: 2 | 3 | 4) => {
    const needed     = count - 1;
    const available  = tabs.filter(t => t.id !== activeTabId && !t.url.startsWith('web20://'));
    const newPanels: string[] = [];

    for (let i = 0; i < needed; i++) {
      if (i < available.length) {
        newPanels.push(available[i].id);
      } else {
        const id = String(Date.now() + i);
        setTabs(prev => [...prev, { id, title: 'New Tab', url: 'web20://start' }]);
        newPanels.push(id);
      }
    }
    setSplitPanels(newPanels);
    setPanelSizes(equalSizes(count));
  }, [tabs, activeTabId]);

  const handleExitSplit = useCallback(() => {
    setSplitPanels([]);
    setPanelSizes([100]);
  }, []);

  const handlePanelResize = useCallback((sizes: number[]) => {
    setPanelSizes(sizes);
  }, []);

  // ── Custom sticky apps ──────────────────────────────────────────────────────
  const [customApps, setCustomApps] = useState(() => getCustomApps());

  const allStickyApps = useMemo(
    () => [...STICKY_APPS, ...customApps],
    [customApps],
  );

  const handleAddCustomApp = useCallback((name: string, url: string) => {
    const app = addCustomApp(name, url);
    setCustomApps(prev => [...prev, app]);
  }, []);

  const handleRemoveCustomApp = useCallback((id: string) => {
    if (activeStickyApp === id) setActiveStickyApp(null);
    setCustomApps(removeCustomApp(id));
  }, [activeStickyApp]);

  // ── Sticky apps ────────────────────────────────────────────────────────────
  const handleToggleStickyApp = useCallback((id: string) => {
    setActiveStickyApp(prev => prev === id ? null : id);
  }, []);

  // ── Webview popup redirect ─────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = window.electronAPI?.onNewWindow((url: string) => navigate(url));
    return () => cleanup?.();
  }, [navigate]);

  // ── Favourites ─────────────────────────────────────────────────────────────
  const handleToggleFavorite = useCallback((domain: string) => {
    setSites(prev => {
      const existing = prev.find(s => s.url.toLowerCase() === domain.toLowerCase());
      if (existing) return prev.filter(s => s.id !== existing.id);
      const raw   = domain.split('.')[0];
      const name  = raw.charAt(0).toUpperCase() + raw.slice(1);
      const color = ACCENT_PALETTE[prev.length % ACCENT_PALETTE.length];
      return [...prev, { id: String(Date.now()), name, url: domain, color }];
    });
  }, []);

  const handleRemoveSite = useCallback((id: string) => { setSites(prev => prev.filter(s => s.id !== id)); }, []);
  const handleEditSite   = useCallback((id: string, name: string, url: string) => {
    const domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    setSites(prev => prev.map(s => s.id === id ? { ...s, name, url: domain } : s));
  }, []);

  // ── Bookmarks ──────────────────────────────────────────────────────────────
  const handleAddBookmark = useCallback(() => {
    if (isInternal) return;
    const bm = addBookmark({ url: currentUrl, title: activeTab?.title || currentUrl, favicon: activeTab?.favicon });
    setBookmarks(prev => [bm, ...prev.filter(b => b.id !== bm.id)]);
  }, [isInternal, currentUrl, activeTab]);

  const handleRemoveBookmark = useCallback((id: string) => {
    removeBookmark(id);
    setBookmarks(prev => prev.filter(b => b.id !== id));
  }, []);

  // ── Data clear ─────────────────────────────────────────────────────────────
  const handleClearHistory   = useCallback(() => { clearHistory();   setHistory([]); }, []);
  const handleClearBookmarks = useCallback(() => { clearBookmarks(); setBookmarks([]); }, []);
  const handleClearDownloads = useCallback(() => { clearDownloads(); setDownloads([]); }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Tab switcher (Ctrl+Tab) — only when 2+ tabs exist
      if (e.ctrlKey && e.key === 'Tab' && !tabSwitcherOpen && tabs.length > 1) {
        e.preventDefault();
        setTabSwitcherDir(e.shiftKey ? -1 : 1);
        setTabSwitcherOpen(true);
        return;
      }

      if (e.key === 'Escape') {
        if (tabSwitcherOpen) { setTabSwitcherOpen(false); return; }
        if (findBarOpen)     { handleFindClose(); return; }
        if (pinnedPopup)     { setPinnedPopup(null); return; }
        setOpenMenu(null);
        setSiteManagerOpen(false);
        setActiveStickyApp(null);
        return;
      }

      // F12 — DevTools for the active webview
      if (e.key === 'F12') {
        e.preventDefault();
        if (isElectron && !isInternal) webViewRef.current?.openDevTools(activeTabId);
        return;
      }

      if (!meta) return;

      switch (e.key) {
        case 't': e.preventDefault(); handleNewTab();    break;
        case 'w': {
          e.preventDefault();
          handleCloseTab(activeTabId);
          break;
        }
        case 'k': {
          e.preventDefault();
          const bar = addressBarRef.current;
          if (bar) { bar.focus(); bar.select(); }
          break;
        }
        case 'r': e.preventDefault(); handleReload();           break;
        case 'n': {
          e.preventDefault();
          if (e.shiftKey) handleNewPrivateWindow();
          else            handleNewWindow();
          break;
        }
        case 'f': e.preventDefault(); handleFindInPage();       break;
        case 'p': e.preventDefault(); handlePrint();            break;
        case 'b': e.preventDefault(); navigate('web20://bookmarks'); break;
        case 'h': e.preventDefault(); navigate('web20://history');   break;
        case 'j': e.preventDefault(); navigate('web20://downloads'); break;
        case '=':
        case '+': e.preventDefault(); handleZoomIn();    break;
        case '-': e.preventDefault(); handleZoomOut();   break;
        case '0': e.preventDefault(); handleResetZoom(); break;
        default: {
          // Ctrl+1–9: jump to tab by index
          const num = parseInt(e.key, 10);
          if (!isNaN(num) && num >= 1 && num <= 9) {
            e.preventDefault();
            const target = tabs[num - 1];
            if (target) setActiveTabId(target.id);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleNewTab, handleCloseTab, handleReload, handleNewWindow, handleNewPrivateWindow,
    handleFindInPage, handlePrint, handleZoomIn, handleZoomOut, handleResetZoom,
    handleFindClose, navigate, activeTabId, findBarOpen, tabSwitcherOpen, tabs, pinnedPopup,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const outerCls = isElectron
    ? "w-screen h-screen overflow-hidden bg-[#060606]"
    : "size-full min-h-screen flex items-center justify-center bg-[#060606] p-6";

  const stageCls = isElectron
    ? "relative w-full h-full bg-[#0B0B0C] flex flex-col overflow-hidden"
    : "relative w-full max-w-[1440px] aspect-[16/10] rounded-2xl overflow-hidden border border-white/[0.07] shadow-[0_48px_128px_rgba(0,0,0,0.72)] bg-[#0B0B0C] flex flex-col";

  return (
    <div className={outerCls}>
      <div id="w2-stage" className={stageCls}>

        {/* ── Background (internal pages) ───────────────────────────── */}
        {isInternal && (
          <>
            <div
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              <div className="absolute ambient-a" style={{ width:"52%",height:"62%",top:"-8%",left:"-6%",background:"radial-gradient(ellipse at center,rgba(255,255,255,0.05) 0%,transparent 68%)",filter:"blur(80px)" }} />
              <div className="absolute ambient-b" style={{ width:"46%",height:"55%",bottom:"-12%",right:"-8%",background:"radial-gradient(ellipse at center,rgba(255,255,255,0.038) 0%,transparent 65%)",filter:"blur(96px)" }} />
              <div className="absolute ambient-c" style={{ width:"38%",height:"42%",top:"28%",left:"32%",background:"radial-gradient(ellipse at center,rgba(255,255,255,0.018) 0%,transparent 60%)",filter:"blur(104px)" }} />
            </div>
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.026] mix-blend-overlay z-0"
              style={{ backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }}
            />
          </>
        )}

        {/* ── TopBar ────────────────────────────────────────────────── */}
        <div ref={topBarRef}>
        <TopBar
          tabs={tabs}
          setTabs={setTabs}
          activeTab={activeTabId}
          setActiveTab={setActiveTabId}
          onNewTab={handleNewTab}
          addressBarRef={addressBarRef}
          onOpenMenu={(k) => setOpenMenu(k)}
          openMenu={openMenu}
          onGoHome={handleGoHome}
          sites={sites}
          onToggleFavorite={handleToggleFavorite}
          currentUrl={currentUrl}
          isLoading={activeTab?.isLoading ?? false}
          canGoBack={activeTab?.canGoBack ?? false}
          canGoForward={activeTab?.canGoForward ?? false}
          onNavigate={navigate}
          onBack={handleBack}
          onForward={handleForward}
          onReload={handleReload}
          onStop={handleStop}
          bookmarks={bookmarks}
          onAddBookmark={handleAddBookmark}
          onRemoveBookmark={handleRemoveBookmark}
          isPrivate={isPrivate}
          onPinTab={handlePinTab}
          pinnedItems={pinnedItems}
          onPinnedAction={handlePinnedAction}
          profiles={profiles}
          activeProfileId={activeProfileId}
          onSwitchProfile={handleSwitchProfile}
          onMuteTab={handleMuteTab}
          navLog={tabNavLogs[activeTabId]}
        />
        </div>

        {/* ── Content row (sidebar + main) ──────────────────────────── */}
        <div className="flex flex-1 overflow-hidden z-10">

          {/* Sticky apps sidebar */}
          <StickyAppsBar
            apps={allStickyApps}
            activeAppId={activeStickyApp}
            onToggle={handleToggleStickyApp}
            onAddApp={handleAddCustomApp}
            onRemoveApp={handleRemoveCustomApp}
          />

          {/* Main content area
              pointerEvents:none when a menu/overlay is open so Electron webviews
              cannot intercept events that belong to the portal menus above them. */}
          <div
            className="flex-1 relative overflow-hidden"
            style={{ pointerEvents: (openMenu || pinnedPopup) ? 'none' : undefined }}
          >

            {/* Internal pages */}
            {isInternal && (
              <div
                className={splitPanels.length ? "absolute top-0 left-0 h-full overflow-auto" : "absolute inset-0"}
                style={splitPanels.length ? { width: `${panelSizes[0] ?? 50}%` } : undefined}
              >
                <InternalPages
                  page={internalPage}
                  sites={sites}
                  history={history}
                  bookmarks={bookmarks}
                  downloads={downloads}
                  onNavigate={navigate}
                  onOpenManager={() => setSiteManagerOpen(true)}
                  onRemoveSite={handleRemoveSite}
                  onEditSite={handleEditSite}
                  onOpenBookmark={navigate}
                  onRemoveBookmark={handleRemoveBookmark}
                  onClearHistory={handleClearHistory}
                  onClearBookmarks={handleClearBookmarks}
                  onClearDownloads={handleClearDownloads}
                  profiles={profiles}
                  activeProfileId={activeProfileId}
                  onSwitchProfile={handleSwitchProfile}
                  onProfilesChange={handleProfilesChange}
                  injections={injections}
                  onInjectionsChange={handleInjectionsChange}
                />
              </div>
            )}

            {/* WebView stack */}
            {isElectron && (
              <WebViewStack
                ref={webViewRef}
                tabs={tabs}
                activeTabId={activeTabId}
                splitPanels={splitPanels}
                panelSizes={panelSizes}
                onPanelResize={handlePanelResize}
                onTabUpdate={handleTabUpdate}
                onHistoryEntry={handleHistoryEntry}
                onFindResult={handleFindResult}
                disablePointer={!!openMenu || !!pinnedPopup || !!contextMenu}
                profiles={profiles}
                injectionsRef={injectionsRef}
              />
            )}

            {/* Dev-mode hint */}
            {!isElectron && !isInternal && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/30">
                <div className="text-[14px]">Webview requires Electron</div>
                <div className="text-[12px] text-white/20">
                  Run <code className="font-mono text-white/40">npm start</code> to open the full browser
                </div>
              </div>
            )}

            {/* Split exit button (shown top-center when in split mode) */}
            {splitPanels.length > 0 && (
              <button
                onClick={handleExitSplit}
                className="absolute top-2 left-1/2 -translate-x-1/2 z-30
                  px-3 h-5 rounded-full bg-[#1A1A1C] border border-white/[0.12]
                  flex items-center justify-center text-white/45 hover:text-white/80
                  hover:bg-white/[0.1] transition-colors shadow-md
                  text-[9px] leading-none font-medium"
              >
                × Exit split
              </button>
            )}

            {/* Find bar */}
            {findBarOpen && !isInternal && (
              <FindBar
                onFind={handleFindSubmit}
                onClose={handleFindClose}
                matchCount={findMatches?.matches}
                activeMatch={findMatches?.active}
              />
            )}

            {/* Sticky apps slide-out panel */}
            <StickyAppsLayer
              apps={allStickyApps}
              activeAppId={activeStickyApp}
              onClose={() => setActiveStickyApp(null)}
            />
          </div>
        </div>

        {/* ── Menus ─────────────────────────────────────────────────── */}
        <Menus
          which={openMenu}
          onClose={() => setOpenMenu(null)}
          history={history}
          bookmarks={bookmarks}
          downloads={downloads}
          currentUrl={isInternal ? '' : currentUrl}
          currentTitle={activeTab?.title ?? ''}
          onNavigate={navigate}
          onAddBookmark={handleAddBookmark}
          onRemoveBookmark={handleRemoveBookmark}
          onClearHistory={handleClearHistory}
          onNewTab={handleNewTab}
          onGoHome={handleGoHome}
          onNewWindow={handleNewWindow}
          onNewPrivateWindow={handleNewPrivateWindow}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          zoomLevel={currentZoom}
          onPrint={handlePrint}
          onScreenshot={handleScreenshot}
          onFindInPage={handleFindInPage}
          onSetSplitMode={handleSetSplitMode}
          onExitSplit={handleExitSplit}
          splitPanelCount={totalPanels}
          pinnedItems={pinnedItems}
          onTogglePin={handleTogglePin}
          menuTop={menuTop}
        />

        {/* ── Site Manager ──────────────────────────────────────────── */}
        <SiteManager
          open={siteManagerOpen}
          sites={sites}
          onClose={() => setSiteManagerOpen(false)}
          onSitesChange={setSites}
        />
      </div>

      {/* ── Tab Switcher popup ────────────────────────────────────────── */}
      {tabSwitcherOpen && (
        <TabSwitcher
          tabs={tabs}
          activeTabId={activeTabId}
          initialDir={tabSwitcherDir}
          onSelect={setActiveTabId}
          onClose={() => setTabSwitcherOpen(false)}
        />
      )}

      {/* ── Pinned popup ──────────────────────────────────────────────── */}
      {pinnedPopup && (
        <PinnedPopup
          id={pinnedPopup.id}
          anchor={pinnedPopup.anchor}
          history={history}
          bookmarks={bookmarks}
          downloads={downloads}
          onNavigate={(url) => { navigate(url); setPinnedPopup(null); }}
          onClose={() => setPinnedPopup(null)}
        />
      )}

      {/* ── Context menu ──────────────────────────────────────────────── */}
      {contextMenu && (
        <ContextMenu
          params={contextMenu}
          onClose={() => setContextMenu(null)}
          onOpenTab={handleOpenInNewTab}
          onScreenshot={handleScreenshot}
        />
      )}

      {/* ── Toast notification ────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
