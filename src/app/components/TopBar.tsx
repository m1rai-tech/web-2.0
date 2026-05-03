import React, {
  useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Plus, X,
  Lock, MoreHorizontal, Star, Bookmark, EyeOff, Pin, PinOff,
  Download, History, Puzzle, Camera, Search as SearchIcon, Printer, User,
  Volume2, VolumeX,
} from "lucide-react";
import type { PinnableId } from "../services/pinnableActions";
import type { Profile } from "../services/profiles";
import { LogoMark } from "./Logo";
import { Tip }      from "./Tip";
import { kbd }      from "../utils/platform";
import type { Tab, Site, Bookmark as BookmarkType } from "../types";

type MenuKey = "menu" | null;

const PINNABLE_ICON: Record<PinnableId, React.ComponentType<any>> = {
  downloads:  Download,
  extensions: Puzzle,
  history:    History,
  bookmarks:  Bookmark,
  screenshot: Camera,
  find:       SearchIcon,
  print:      Printer,
};

const PINNABLE_LABEL: Record<PinnableId, string> = {
  downloads:  'Downloads',
  extensions: 'Extensions',
  history:    'History',
  bookmarks:  'Bookmarks',
  screenshot: 'Screenshot',
  find:       'Find in page',
  print:      'Print',
};

interface TopBarProps {
  tabs:             Tab[];
  setTabs:          React.Dispatch<React.SetStateAction<Tab[]>>;
  activeTab:        string;
  setActiveTab:     (id: string) => void;
  onNewTab:         () => void;
  addressBarRef:    React.RefObject<HTMLInputElement>;
  onOpenMenu:       (k: MenuKey) => void;
  openMenu:         string | null;
  onGoHome:         () => void;
  sites:            Site[];
  onToggleFavorite: (domain: string) => void;
  currentUrl:       string;
  isLoading:        boolean;
  canGoBack:        boolean;
  canGoForward:     boolean;
  onNavigate:       (url: string) => void;
  onBack:           () => void;
  onForward:        () => void;
  onReload:         () => void;
  onStop:           () => void;
  bookmarks:        BookmarkType[];
  onAddBookmark:    () => void;
  onRemoveBookmark: (id: string) => void;
  isPrivate?:       boolean;
  onPinTab:         (id: string) => void;
  pinnedItems?:     PinnableId[];
  onPinnedAction?:  (id: PinnableId, anchor: DOMRect) => void;
  profiles?:        Profile[];
  activeProfileId?: string;
  onSwitchProfile?: (id: string) => void;
  onMuteTab?:       (tabId: string, muted: boolean) => void;
  navLog?:          string[]; // recent URLs visited in the active tab (for back-button dropdown)
}

const MAX_TAB_W    = 220;
const MIN_TAB_W    = 90;
const PINNED_TAB_W = 36;
const PLUS_BTN_W   = 48;
const EXPAND_DELAY = 2000;

function idealTabWidth(containerPx: number, pinned: number, unpinned: number): number {
  if (unpinned === 0) return MAX_TAB_W;
  const used      = pinned * (PINNED_TAB_W + 2);
  const available = Math.max(0, containerPx - PLUS_BTN_W - used);
  return Math.max(MIN_TAB_W, Math.min(MAX_TAB_W, Math.floor(available / unpinned)));
}

// ── Tab context menu ──────────────────────────────────────────────────────────

interface TabCtxMenuState { x: number; y: number; tabId: string; isPinned: boolean }

function TabContextMenu({
  state, onClose, onPin, onClose_tab,
}: {
  state:       TabCtxMenuState;
  onClose:     () => void;
  onPin:       (id: string) => void;
  onClose_tab: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('keydown', keyHandler);
    }, 0);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  // Adjust to viewport edges
  const [pos, setPos] = useState({ x: state.x, y: state.y });
  useEffect(() => {
    if (!ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    const vw = window.innerWidth, vh = window.innerHeight;
    setPos({
      x: Math.min(state.x, vw - w - 8),
      y: Math.min(state.y, vh - h - 8),
    });
  }, [state.x, state.y]);

  const item = (label: string, icon: React.ReactNode, action: () => void, danger = false) => (
    <button
      onClick={() => { action(); onClose(); }}
      className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg
        hover:bg-white/[0.06] text-left transition-colors duration-75 cursor-pointer
        ${danger ? 'text-red-400/80' : 'text-white/80'}`}
    >
      <span className="w-4 flex items-center justify-center text-white/45 shrink-0">{icon}</span>
      <span className="text-[12px]">{label}</span>
    </button>
  );

  return createPortal(
    <div
      ref={ref}
      className="fixed animate-menu-in
        bg-[#0F0F10]/97 border border-white/[0.1] rounded-xl overflow-hidden p-1.5
        shadow-[0_16px_48px_rgba(0,0,0,0.65)]"
      style={{ left: pos.x, top: pos.y, zIndex: 9200, minWidth: 180 }}
    >
      {item(
        state.isPinned ? 'Unpin tab' : 'Pin tab',
        state.isPinned ? <PinOff size={12} strokeWidth={1.75} /> : <Pin size={12} strokeWidth={1.75} />,
        () => onPin(state.tabId),
      )}
      <div className="my-1 mx-2 border-t border-white/[0.06]" />
      {item(
        `Close tab   ${kbd('W')}`,
        <X size={11} strokeWidth={2} />,
        () => onClose_tab(state.tabId),
        true,
      )}
    </div>,
    document.body
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────

export function TopBar({
  tabs, setTabs, activeTab, setActiveTab,
  onNewTab, addressBarRef, onOpenMenu, openMenu, onGoHome,
  sites, onToggleFavorite,
  currentUrl, isLoading, canGoBack, canGoForward,
  onNavigate, onBack, onForward, onReload, onStop,
  bookmarks, onAddBookmark, onRemoveBookmark,
  isPrivate = false,
  onPinTab,
  pinnedItems = [],
  onPinnedAction,
  profiles = [],
  activeProfileId = 'default',
  onSwitchProfile,
  onMuteTab,
  navLog = [],
}: TopBarProps) {

  const [backDropOpen, setBackDropOpen] = useState(false);
  const backBtnRef = useRef<HTMLButtonElement>(null);

  // ── Tab sort: pinned first ─────────────────────────────────────────────────
  const sortedTabs = useMemo(() => {
    const pinned   = tabs.filter(t => t.isPinned);
    const unpinned = tabs.filter(t => !t.isPinned);
    return [...pinned, ...unpinned];
  }, [tabs]);

  const pinnedCount   = sortedTabs.filter(t => t.isPinned).length;
  const unpinnedCount = sortedTabs.length - pinnedCount;

  // ── Address bar ───────────────────────────────────────────────────────────
  const [addrValue,   setAddrValue]   = useState("");
  const [addrFocused, setAddrFocused] = useState(false);

  useEffect(() => {
    if (addrFocused) return;
    setAddrValue(currentUrl.startsWith('web20://') ? '' : currentUrl);
  }, [currentUrl, addrFocused]);

  const addrDomain = useMemo(() => {
    if (currentUrl.startsWith('web20://')) return '';
    return currentUrl.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].toLowerCase();
  }, [currentUrl]);

  const isAddrFavorited = useMemo(
    () => !!addrDomain && sites.some(s => s.url.toLowerCase() === addrDomain),
    [addrDomain, sites]
  );

  const isBookmarked = useMemo(
    () => !currentUrl.startsWith('web20://') && bookmarks.some(b => b.url === currentUrl),
    [currentUrl, bookmarks]
  );

  // ── Tab width system ───────────────────────────────────────────────────────
  const tabContainerRef  = useRef<HTMLDivElement>(null);
  const [tabWidth, setTabWidth] = useState(MAX_TAB_W);

  const isFrozenRef    = useRef(false);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCountRef   = useRef(tabs.length);
  const tabsCountRef   = useRef(tabs.length);
  const unpinnedRef    = useRef(unpinnedCount);

  useEffect(() => { tabsCountRef.current = tabs.length; unpinnedRef.current = unpinnedCount; }, [tabs.length, unpinnedCount]);

  useLayoutEffect(() => {
    const el = tabContainerRef.current;
    if (!el) return;
    setTabWidth(idealTabWidth(el.offsetWidth, pinnedCount, unpinnedCount));
    prevCountRef.current = tabs.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = tabContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!isFrozenRef.current) {
        setTabWidth(idealTabWidth(el.offsetWidth, pinnedCount, unpinnedRef.current));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pinnedCount]);

  useEffect(() => {
    const prev = prevCountRef.current;
    const curr = tabs.length;
    if (curr === prev) return;
    prevCountRef.current = curr;
    const el = tabContainerRef.current;

    if (curr > prev) {
      if (expandTimerRef.current) { clearTimeout(expandTimerRef.current); expandTimerRef.current = null; }
      isFrozenRef.current = false;
      if (el) setTabWidth(idealTabWidth(el.offsetWidth, pinnedCount, unpinnedRef.current));
    } else {
      isFrozenRef.current = true;
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      expandTimerRef.current = setTimeout(() => {
        isFrozenRef.current = false;
        expandTimerRef.current = null;
        const container = tabContainerRef.current;
        if (container) setTabWidth(idealTabWidth(container.offsetWidth, pinnedCount, unpinnedRef.current));
      }, EXPAND_DELAY);
    }
  }, [tabs.length, pinnedCount]);

  useEffect(() => () => { if (expandTimerRef.current) clearTimeout(expandTimerRef.current); }, []);

  // ── Tab close ──────────────────────────────────────────────────────────────
  const closeTab = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      return next.length === 0 ? [{ id: String(Date.now()), title: 'New Tab', url: 'web20://start' }] : next;
    });
  }, [setTabs]);

  // ── Context menu ──────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<TabCtxMenuState | null>(null);

  const handleTabContextMenu = useCallback((tab: Tab, e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id, isPinned: !!tab.isPinned });
  }, []);

  // ── Address bar handlers ───────────────────────────────────────────────────
  const handleAddrFocus = () => {
    setAddrFocused(true);
    setTimeout(() => { addressBarRef.current?.select(); }, 0);
  };
  const handleAddrBlur  = () => {
    setAddrFocused(false);
    setAddrValue(currentUrl.startsWith('web20://') ? '' : currentUrl);
  };
  const handleAddrKey   = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = addrValue.trim();
      if (val) onNavigate(val);
      e.currentTarget.blur();
    }
    if (e.key === 'Escape') {
      setAddrValue(currentUrl.startsWith('web20://') ? '' : currentUrl);
      e.currentTarget.blur();
    }
  };

  // ── Bookmark / star ────────────────────────────────────────────────────────
  const handleBookmarkToggle = () => {
    if (currentUrl.startsWith('web20://')) return;
    if (isBookmarked) {
      const bm = bookmarks.find(b => b.url === currentUrl);
      if (bm) onRemoveBookmark(bm.id);
    } else {
      onAddBookmark();
    }
  };
  const handleStarToggle = () => { if (addrDomain) onToggleFavorite(addrDomain); };

  return (
    <div
      className="relative z-20 border-b border-white/[0.06] bg-black/50 backdrop-blur-xl shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Loading bar */}
      <div
        className="absolute bottom-0 left-0 h-[1.5px] bg-white/[0.4] pointer-events-none z-10"
        style={{
          width: `${isLoading ? 85 : 0}%`,
          opacity: isLoading ? 1 : 0,
          transition: isLoading
            ? 'width 2s ease-out, opacity 0.2s ease'
            : 'width 0.3s ease, opacity 0.3s ease',
        }}
      />

      {/* ── Tab row ───────────────────────────────────────────────────── */}
      <div className="flex items-end h-10 pl-3 pr-2 pt-2 gap-0">

        <Tip label="Start Hub" delay={400}>
          <button
            onClick={onGoHome}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="mb-1 mr-2.5 shrink-0 flex items-center justify-center w-8 h-7 rounded-md
              text-white/55 hover:text-white/90 hover:bg-white/[0.06]
              active:scale-95 transition-all duration-150 cursor-pointer"
            aria-label="Return to Start Hub"
          >
            <LogoMark size={17} />
          </button>
        </Tip>

        {isPrivate && (
          <div
            className="mb-1 mr-2 shrink-0 flex items-center gap-1 h-7 px-2 rounded-md
              bg-purple-500/[0.12] border border-purple-400/[0.18] text-purple-300/80"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <EyeOff size={9} strokeWidth={2} />
            <span className="text-[9.5px] tracking-wide uppercase">Private</span>
          </div>
        )}

        <div
          ref={tabContainerRef}
          className="flex items-end gap-[2px] flex-1 min-w-0 overflow-hidden"
        >
          {sortedTabs.map((t) => {
            const isActive  = t.id === activeTab;
            const isPinned  = !!t.isPinned;

            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                onContextMenu={(e) => handleTabContextMenu(t, e)}
                style={{
                  width: isPinned ? PINNED_TAB_W : tabWidth,
                  minWidth: isPinned ? PINNED_TAB_W : MIN_TAB_W,
                  transition: "width 360ms cubic-bezier(0.4, 0, 0.2, 1)",
                  WebkitAppRegion: 'no-drag',
                  flexShrink: isPinned ? 0 : undefined,
                } as React.CSSProperties}
                className={`group relative flex items-center justify-center gap-[7px]
                  h-8 rounded-t-[8px] shrink-0 overflow-hidden
                  transition-colors duration-150 border-t border-l border-r text-left
                  ${isPinned ? 'px-0' : 'pl-3 pr-1.5'}
                  ${isActive
                    ? "bg-white/[0.07] border-white/[0.1] text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "border-transparent text-white/38 hover:text-white/65 hover:bg-white/[0.03]"
                  }`}
              >
                {/* Favicon / dot / audio indicator */}
                {(t.isMuted || t.isAudible) ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMuteTab?.(t.id, !t.isMuted); }}
                    className="w-3 h-3 shrink-0 flex items-center justify-center
                      hover:opacity-70 transition-opacity"
                    style={{ color: t.isMuted ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)' }}
                    title={t.isMuted ? 'Unmute tab' : 'Mute tab'}
                  >
                    {t.isMuted
                      ? <VolumeX size={10} strokeWidth={2} />
                      : <Volume2 size={10} strokeWidth={2} />}
                  </button>
                ) : t.favicon ? (
                  <img
                    src={t.favicon}
                    alt=""
                    width={12}
                    height={12}
                    className="w-3 h-3 object-contain shrink-0 rounded-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className={`w-[5px] h-[5px] rounded-full shrink-0 transition-colors ${
                    isActive ? "bg-white/55" : "bg-white/18 group-hover:bg-white/28"
                  }`} />
                )}

                {/* Title (only for unpinned) */}
                {!isPinned && (
                  <span className="truncate text-[12px] flex-1 leading-none select-none">
                    {t.isLoading ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border border-white/30 border-t-white/70 animate-spin shrink-0" />
                        <span className="truncate">{t.title}</span>
                      </span>
                    ) : t.title}
                  </span>
                )}

                {/* Pin indicator (small dot on pinned tabs) */}
                {isPinned && isActive && (
                  <div className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/40" />
                )}

                {/* Close (unpinned only) */}
                {!isPinned && (
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => closeTab(t.id, e)}
                    className="w-[18px] h-[18px] rounded flex items-center justify-center
                      opacity-0 group-hover:opacity-100 hover:bg-white/[0.1]
                      transition-all duration-150 shrink-0 ml-0.5"
                  >
                    <X size={9} strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}

          <Tip label={`New tab  ${kbd('T')}`} delay={400}>
            <button
              onClick={onNewTab}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="mb-0.5 ml-1 w-7 h-7 rounded-md text-white/32 hover:text-white/70
                hover:bg-white/[0.05] flex items-center justify-center shrink-0
                active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </Tip>
        </div>

        <WinControls />
      </div>

      {/* ── Address row ───────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-[5px]"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-[1px]">
          {/* Back button — right-click shows nav history */}
          <Tip label={`Back      Alt+←`} delay={500}>
            <button
              ref={backBtnRef}
              disabled={!canGoBack}
              onClick={onBack}
              onContextMenu={(e) => {
                e.preventDefault();
                if (navLog.length > 1) setBackDropOpen(v => !v);
              }}
              className="w-[30px] h-[30px] rounded-md flex items-center justify-center
                text-white/40 hover:text-white/85 hover:bg-white/[0.055]
                disabled:opacity-[0.22] disabled:pointer-events-none active:scale-95
                transition-all duration-150 cursor-pointer"
            >
              <ArrowLeft size={14} strokeWidth={1.75} />
            </button>
          </Tip>

          {backDropOpen && (
            <BackHistoryDropdown
              log={navLog}
              anchorRef={backBtnRef}
              onNavigate={(url) => { onNavigate(url); setBackDropOpen(false); }}
              onClose={() => setBackDropOpen(false)}
            />
          )}

          <NavBtn Icon={ArrowRight} label={`Forward   Alt+→`}    disabled={!canGoForward} onClick={onForward} />
          <NavBtn
            Icon={isLoading ? X : RotateCw}
            label={isLoading ? "Stop" : `Reload   ${kbd('R')}`}
            onClick={isLoading ? onStop : onReload}
          />
          <NavBtn Icon={Home} label="Home" onClick={onGoHome} />
        </div>

        <div
          className={`flex-1 mx-2 h-[33px] rounded-lg
            bg-white/[0.04] border
            flex items-center px-3 gap-2 transition-all duration-200
            ${addrFocused
              ? 'border-white/[0.22] bg-white/[0.065]'
              : 'border-white/[0.08] hover:border-white/[0.15]'
            }`}
        >
          <Lock size={10} className="text-white/28 shrink-0" strokeWidth={2} />
          <input
            ref={addressBarRef}
            value={addrValue}
            placeholder="Search or enter address"
            className="flex-1 bg-transparent outline-none text-[12.5px] text-white placeholder:text-white/26"
            onChange={(e) => setAddrValue(e.target.value)}
            onFocus={handleAddrFocus}
            onBlur={handleAddrBlur}
            onKeyDown={handleAddrKey}
          />
          <kbd className="text-[10px] tracking-widest text-white/20 px-1.5 py-[2px] rounded
            border border-white/[0.07] shrink-0 select-none leading-none">
            {kbd('K')}
          </kbd>
        </div>

        <div className="flex items-center gap-[1px]">
          <Tip
            label={isBookmarked ? "Remove bookmark" : currentUrl.startsWith('web20://') ? "Enter a URL first" : "Bookmark this page"}
            delay={400}
          >
            <button
              onClick={handleBookmarkToggle}
              disabled={currentUrl.startsWith('web20://')}
              className={`w-[30px] h-[30px] rounded-md flex items-center justify-center
                transition-all duration-200 disabled:pointer-events-none disabled:opacity-30
                ${isBookmarked ? 'text-amber-400/90 hover:text-amber-300' : 'text-white/40 hover:text-white/85 hover:bg-white/[0.055]'}`}
            >
              <Bookmark
                size={14}
                strokeWidth={1.75}
                className={`transition-all duration-200 ${isBookmarked ? 'fill-current' : ''}`}
              />
            </button>
          </Tip>

          <Tip
            label={isAddrFavorited ? "Remove from favorites" : addrDomain ? "Add to favorites" : "Enter a URL first"}
            delay={400}
          >
            <button
              onClick={handleStarToggle}
              disabled={!addrDomain}
              className={`w-[30px] h-[30px] rounded-md flex items-center justify-center
                transition-all duration-200 disabled:pointer-events-none disabled:opacity-30
                ${isAddrFavorited ? 'text-amber-400/90 hover:text-amber-300' : 'text-white/40 hover:text-white/85 hover:bg-white/[0.055]'}`}
            >
              <Star
                size={14}
                strokeWidth={1.75}
                className={`transition-all duration-200 ${isAddrFavorited ? 'fill-current' : ''}`}
              />
            </button>
          </Tip>

          <div className="w-px h-3.5 bg-white/[0.08] mx-1.5" />

          {/* ── Pinned toolbar actions ─────────────────────────────── */}
          {pinnedItems.length > 0 && (
            <>
              {pinnedItems.map(id => {
                const Icon = PINNABLE_ICON[id];
                const label = PINNABLE_LABEL[id];
                return (
                  <Tip key={id} label={label} delay={400}>
                    <button
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        onPinnedAction?.(id, rect);
                      }}
                      className="w-[30px] h-[30px] rounded-md flex items-center justify-center
                        text-white/40 hover:text-white/85 hover:bg-white/[0.055]
                        active:scale-95 transition-all duration-150 cursor-pointer"
                    >
                      <Icon size={14} strokeWidth={1.75} />
                    </button>
                  </Tip>
                );
              })}
              <div className="w-px h-3.5 bg-white/[0.08] mx-0.5" />
            </>
          )}

          {/* ── Profile badge ─────────────────────────────────────── */}
          {profiles.length > 0 && onSwitchProfile && (
            <ProfileBadge
              profiles={profiles}
              activeProfileId={activeProfileId}
              onSwitch={onSwitchProfile}
              onManage={() => onNavigate('web20://profiles')}
            />
          )}

          <Tip label="Browser menu" delay={500}>
            <button
              onClick={() => onOpenMenu(openMenu === "menu" ? null : "menu")}
              className={`w-[30px] h-[30px] rounded-md flex items-center justify-center
                transition-colors duration-150 cursor-pointer
                ${openMenu === "menu"
                  ? "bg-white/[0.09] text-white/90"
                  : "text-white/40 hover:text-white/85 hover:bg-white/[0.055]"
                }`}
              aria-label="Open browser menu"
            >
              <MoreHorizontal size={14} strokeWidth={1.75} />
            </button>
          </Tip>
        </div>
      </div>

      {/* ── Tab context menu ──────────────────────────────────────────── */}
      {ctxMenu && (
        <TabContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onPin={(id) => { onPinTab(id); setCtxMenu(null); }}
          onClose_tab={(id) => { closeTab(id); setCtxMenu(null); }}
        />
      )}
    </div>
  );
}

// ── Window controls ───────────────────────────────────────────────────────────

function WinControls() {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-[9px] mb-[9px] pl-4 pr-2 shrink-0"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <WinDot color="#FEBC2E" label="Minimize" icon="−" hovered={hovered} onClick={() => window.electronAPI?.minimize()} />
      <WinDot color="#28C840" label="Maximize" icon="+" hovered={hovered} onClick={() => window.electronAPI?.maximize()} />
      <WinDot color="#FF5F57" label="Close"    icon="×" hovered={hovered} onClick={() => window.electronAPI?.close()} />
    </div>
  );
}

function WinDot({ color, label, icon, hovered, onClick }: {
  color: string; label: string; icon: string; hovered: boolean; onClick?: () => void;
}) {
  return (
    <Tip label={label} delay={200}>
      <button
        aria-label={label}
        onClick={onClick}
        style={{ background: color }}
        className="w-[14px] h-[14px] rounded-full flex items-center justify-center
          transition-all duration-150 select-none
          opacity-75 hover:opacity-100 active:scale-[0.88]
          shadow-[0_1px_3px_rgba(0,0,0,0.3)] cursor-pointer"
      >
        <span
          className="text-black/55 leading-none font-medium transition-opacity duration-100"
          style={{ fontSize: 9, opacity: hovered ? 1 : 0, letterSpacing: 0 }}
        >
          {icon}
        </span>
      </button>
    </Tip>
  );
}

// ── Back history dropdown ─────────────────────────────────────────────────────

function BackHistoryDropdown({ log, anchorRef, onNavigate, onClose }: {
  log:       string[];
  anchorRef: React.RefObject<HTMLButtonElement>;
  onNavigate:(url: string) => void;
  onClose:   () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Dedupe, drop the last entry (current page), show newest-first
  const entries = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = log.length - 2; i >= 0; i--) {
      const url = log[i];
      if (!seen.has(url)) { seen.add(url); out.push(url); }
      if (out.length >= 12) break;
    }
    return out;
  }, [log]);

  useEffect(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const menu   = menuRef.current?.getBoundingClientRect();
    if (!anchor || !menu) return;
    setPos({
      x: Math.max(8, anchor.left),
      y: anchor.bottom + 6,
    });
  }, [anchorRef]);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => {
      document.addEventListener('mousedown', onMouse);
      document.addEventListener('keydown',   onKey);
    }, 0);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown',   onKey);
    };
  }, [onClose]);

  if (entries.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed animate-menu-in
        bg-[#0F0F10]/97 border border-white/[0.1] rounded-xl overflow-hidden p-1.5
        shadow-[0_16px_48px_rgba(0,0,0,0.65)]"
      style={{ left: pos.x, top: pos.y, zIndex: 9200, minWidth: 260, maxWidth: 360 }}
    >
      {entries.map((url, i) => {
        const domain = url.replace(/^https?:\/\//, '').split('/')[0];
        const faviconSrc = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
        const label = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return (
          <button
            key={i}
            onClick={() => onNavigate(url)}
            className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg
              hover:bg-white/[0.06] text-left transition-colors duration-75 cursor-pointer"
          >
            <img
              src={faviconSrc}
              alt=""
              width={12}
              height={12}
              className="w-3 h-3 shrink-0 object-contain rounded-sm"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="text-[12px] text-white/70 truncate">{label}</span>
          </button>
        );
      })}
    </div>,
    document.body
  );
}

// ── Profile badge ─────────────────────────────────────────────────────────────

function ProfileBadge({ profiles, activeProfileId, onSwitch, onManage }: {
  profiles:        Profile[];
  activeProfileId: string;
  onSwitch:        (id: string) => void;
  onManage:        () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const active = profiles.find(p => p.id === activeProfileId) ?? profiles[0];
  if (!active) return null;

  const isDefault = active.id === 'default';

  return (
    <>
      <Tip label={`Profile: ${active.name}`} delay={400}>
        <button
          ref={btnRef}
          onClick={() => setOpen(v => !v)}
          className={`w-[30px] h-[30px] rounded-md flex items-center justify-center
            transition-all duration-150 cursor-pointer
            ${open ? 'bg-white/[0.09]' : 'hover:bg-white/[0.055]'}`}
          style={{ color: isDefault ? 'rgba(255,255,255,0.40)' : active.color }}
        >
          <User size={14} strokeWidth={1.75} />
        </button>
      </Tip>

      {open && (
        <ProfileDropdown
          profiles={profiles}
          activeProfileId={activeProfileId}
          anchorRef={btnRef}
          onSwitch={(id) => { onSwitch(id); setOpen(false); }}
          onManage={() => { onManage(); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ProfileDropdown({ profiles, activeProfileId, anchorRef, onSwitch, onManage, onClose }: {
  profiles:        Profile[];
  activeProfileId: string;
  anchorRef:       React.RefObject<HTMLButtonElement>;
  onSwitch:        (id: string) => void;
  onManage:        () => void;
  onClose:         () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const menu   = menuRef.current?.getBoundingClientRect();
    if (!anchor || !menu) return;
    setPos({
      x: Math.max(8, Math.min(anchor.right - menu.width, window.innerWidth - menu.width - 8)),
      y: anchor.bottom + 6,
    });
  }, [anchorRef]);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => {
      document.addEventListener('mousedown', onMouse);
      document.addEventListener('keydown',   onKey);
    }, 0);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown',   onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed animate-menu-in
        bg-[#0F0F10]/97 border border-white/[0.1] rounded-xl overflow-hidden p-1.5
        shadow-[0_16px_48px_rgba(0,0,0,0.65)]"
      style={{ left: pos.x, top: pos.y, zIndex: 9200, minWidth: 180 }}
    >
      <div className="px-3 py-1.5 text-[10px] tracking-[0.22em] uppercase text-white/30">
        Profiles
      </div>

      {profiles.map(p => (
        <button
          key={p.id}
          onClick={() => onSwitch(p.id)}
          className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg
            hover:bg-white/[0.06] text-left transition-colors duration-75 cursor-pointer"
        >
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
          <span className={`text-[12px] flex-1 ${p.id === activeProfileId ? 'text-white/90' : 'text-white/55'}`}>
            {p.name}
          </span>
          {p.id === activeProfileId && (
            <div className="w-1.5 h-1.5 rounded-full bg-white/50 shrink-0" />
          )}
        </button>
      ))}

      <div className="my-1 mx-2 border-t border-white/[0.06]" />

      <button
        onClick={onManage}
        className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg
          hover:bg-white/[0.06] text-left transition-colors duration-75 cursor-pointer
          text-white/45 hover:text-white/75"
      >
        <span className="text-[12px]">Manage profiles…</span>
      </button>
    </div>,
    document.body
  );
}

// ── Nav button ────────────────────────────────────────────────────────────────

function NavBtn({ Icon, label, disabled, onClick }: {
  Icon: React.ComponentType<any>;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tip label={label} delay={500}>
      <button
        disabled={disabled}
        onClick={onClick}
        className="w-[30px] h-[30px] rounded-md flex items-center justify-center
          text-white/40 hover:text-white/85 hover:bg-white/[0.055]
          disabled:opacity-[0.22] disabled:pointer-events-none active:scale-95
          transition-all duration-150 cursor-pointer"
      >
        <Icon size={14} strokeWidth={1.75} />
      </button>
    </Tip>
  );
}
