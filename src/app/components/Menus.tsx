import React, { useState, useRef, useEffect, forwardRef } from "react";
import { createPortal } from "react-dom";
import {
  Download, Bookmark, History, Settings,
  X, LogOut, Search, Plus, ExternalLink,
  EyeOff, Printer, Camera, Columns2, Minus, Puzzle, Pin,
  User, Code2,
} from "lucide-react";
import type { PinnableId } from "../services/pinnableActions";
import type { HistoryEntry, Bookmark as BookmarkType, DownloadItem } from "../types";
import { kbd } from "../utils/platform";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MenusProps {
  which:               string | null;
  onClose:             () => void;
  history:             HistoryEntry[];
  bookmarks:           BookmarkType[];
  downloads:           DownloadItem[];
  currentUrl:          string;
  currentTitle:        string;
  onNavigate:          (url: string) => void;
  onAddBookmark:       () => void;
  onRemoveBookmark:    (id: string) => void;
  onClearHistory:      () => void;
  onNewTab:            () => void;
  onGoHome:            () => void;
  onNewWindow?:        () => void;
  onNewPrivateWindow?: () => void;
  onZoomIn?:           () => void;
  onZoomOut?:          () => void;
  onResetZoom?:        () => void;
  zoomLevel?:          number;
  onPrint?:            () => void;
  onScreenshot?:       () => void;
  onFindInPage?:       () => void;
  onSetSplitMode?:     (count: 2 | 3 | 4) => void;
  onExitSplit?:        () => void;
  splitPanelCount?:    number;
  pinnedItems?:        PinnableId[];
  onTogglePin?:        (id: PinnableId) => void;
  /** Pixel offset from top of viewport where the panel should start (TopBar bottom edge). */
  menuTop?:            number;
}

// ─── Root — rendered via portal so it escapes all stacking contexts ───────────

export function Menus(props: MenusProps) {
  const { which, onClose, menuTop = 88 } = props;
  if (!which || typeof document === 'undefined') return null;

  const panel = (
    <>
      {/* Full-screen backdrop — z-[9000] catches every click outside */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 9000, cursor: 'default' }}
        onClick={onClose}
      />

      {/* Menu panel — floats above backdrop at z-[9001] */}
      <div
        className="fixed right-3"
        style={{ top: menuTop, zIndex: 9001, pointerEvents: 'auto' }}
      >
        <div className="animate-menu-in" style={{ pointerEvents: 'auto' }}>
          {which === "menu" && <MainMenu {...props} />}
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children, w = 300 }: { children: React.ReactNode; w?: number }) {
  return (
    <div
      style={{ width: w }}
      className="rounded-xl border border-white/[0.1] bg-[#0F0F10]/97 backdrop-blur-2xl
        shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_0_0.5px_rgba(255,255,255,0.05)]
        overflow-hidden"
    >
      <div className="p-1.5">{children}</div>
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function Row({
  Icon, label, sub, right, danger, onClick,
  pinnableId, pinned, onTogglePin,
}: {
  Icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label:        string;
  sub?:         string;
  right?:       string;
  danger?:      boolean;
  onClick?:     () => void;
  pinnableId?:  PinnableId;
  pinned?:      boolean;
  onTogglePin?: () => void;
}) {
  const inner = (
    <>
      {Icon && (
        <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08]
          flex items-center justify-center text-white/55 shrink-0">
          <Icon size={13} strokeWidth={1.75} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] leading-tight truncate">{label}</div>
        {sub && <div className="text-[10.5px] text-white/36 truncate mt-0.5">{sub}</div>}
      </div>
      {right && (
        <div className="text-[10.5px] text-white/28 shrink-0 tabular-nums font-mono">
          {right}
        </div>
      )}
    </>
  );

  if (!pinnableId) {
    return (
      <button
        onClick={onClick}
        style={{ pointerEvents: 'auto' }}
        className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg
          hover:bg-white/[0.06] text-left transition-colors duration-100 cursor-pointer
          ${danger ? "text-red-400/88" : "text-white/82"}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="flex items-center group/row gap-0.5 pr-0.5" style={{ pointerEvents: 'auto' }}>
      <button
        onClick={onClick}
        style={{ pointerEvents: 'auto' }}
        className={`flex-1 flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg
          hover:bg-white/[0.06] text-left transition-colors duration-100 cursor-pointer
          ${danger ? "text-red-400/88" : "text-white/82"}`}
      >
        {inner}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}
        style={{ pointerEvents: 'auto' }}
        title={pinned ? 'Remove from toolbar' : 'Pin to toolbar'}
        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0
          transition-all duration-100 cursor-pointer hover:bg-white/[0.07]
          ${pinned
            ? 'text-white/55'
            : 'text-white/18 opacity-0 group-hover/row:opacity-100 hover:!text-white/50'
          }`}
      >
        <Pin size={10} strokeWidth={2} />
      </button>
    </div>
  );
}

function Divider() {
  return <div className="my-1 mx-2 border-t border-white/[0.06]" />;
}

// ─── Zoom button ──────────────────────────────────────────────────────────────

function ZoomBtn({ label, onClick, children }: {
  label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ pointerEvents: 'auto' }}
      className="w-7 h-7 rounded-md flex items-center justify-center
        text-white/55 hover:text-white/90 hover:bg-white/[0.07] transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

// ─── Main menu ────────────────────────────────────────────────────────────────

function MainMenu(props: MenusProps) {
  const {
    onClose, onNewTab, onNavigate,
    onNewWindow, onNewPrivateWindow,
    onZoomIn, onZoomOut, onResetZoom, zoomLevel = 1,
    onPrint, onScreenshot, onFindInPage,
    onSetSplitMode, onExitSplit, splitPanelCount = 0,
    pinnedItems = [], onTogglePin,
  } = props;

  const go  = (fn: () => void) => { fn(); onClose(); };
  const pin = (id: PinnableId) => onTogglePin?.(id);
  const isPinned = (id: PinnableId) => pinnedItems.includes(id);
  const zoomPct = Math.round(zoomLevel * 100);

  return (
    <Shell>
      {/* ── Windows & tabs ─────────────────────────────────────────── */}
      <Row Icon={Plus}         label="New tab"            right={kbd('T')}       onClick={() => go(onNewTab)} />
      <Row Icon={ExternalLink} label="New window"         right={kbd('N')}       onClick={() => go(() => onNewWindow?.())} />
      <Row Icon={EyeOff}       label="New private window" right={kbd('N', true)} onClick={() => go(() => onNewPrivateWindow?.())} />

      <Divider />

      {/* ── Zoom ───────────────────────────────────────────────────── */}
      <div className="flex items-center px-2.5 py-[6px] gap-1.5" style={{ pointerEvents: 'auto' }}>
        <div className="flex-1 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08]
            flex items-center justify-center text-white/55 shrink-0">
            <Search size={12} strokeWidth={1.75} />
          </div>
          <span className="text-[12.5px] text-white/82">Zoom</span>
        </div>
        <div className="flex items-center gap-0.5">
          <ZoomBtn label="Zoom out" onClick={() => onZoomOut?.()}>
            <Minus size={11} strokeWidth={2} />
          </ZoomBtn>
          <button
            onClick={() => onResetZoom?.()}
            style={{ pointerEvents: 'auto' }}
            className="h-7 px-2.5 rounded-md text-[11px] tabular-nums text-white/60
              hover:text-white/90 hover:bg-white/[0.07] transition-colors min-w-[46px] text-center cursor-pointer"
          >
            {zoomPct}%
          </button>
          <ZoomBtn label="Zoom in" onClick={() => onZoomIn?.()}>
            <Plus size={11} strokeWidth={2} />
          </ZoomBtn>
        </div>
      </div>

      <Divider />

      {/* ── Page tools ─────────────────────────────────────────────── */}
      <Row Icon={Search}  label="Find in page" right={kbd('F')} onClick={() => go(() => onFindInPage?.())}
        pinnableId="find"       pinned={isPinned('find')}       onTogglePin={() => pin('find')} />
      <Row Icon={Printer} label="Print"        right={kbd('P')} onClick={() => go(() => onPrint?.())}
        pinnableId="print"      pinned={isPinned('print')}      onTogglePin={() => pin('print')} />
      <Row Icon={Camera}  label="Screenshot"                    onClick={() => go(() => onScreenshot?.())}
        pinnableId="screenshot" pinned={isPinned('screenshot')} onTogglePin={() => pin('screenshot')} />

      {/* Split view row */}
      <div className="flex items-center px-2.5 py-[6px] gap-1.5" style={{ pointerEvents: 'auto' }}>
        <div className="flex-1 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08]
            flex items-center justify-center text-white/55 shrink-0">
            <Columns2 size={12} strokeWidth={1.75} />
          </div>
          <span className="text-[12.5px] text-white/82">Split view</span>
        </div>
        <div className="flex items-center gap-0.5">
          {splitPanelCount > 0 ? (
            <button
              onClick={() => { onExitSplit?.(); onClose(); }}
              style={{ pointerEvents: 'auto' }}
              className="h-7 px-2.5 rounded-md text-[11px] text-white/55
                hover:text-white/90 hover:bg-white/[0.07] transition-colors cursor-pointer"
            >
              Exit
            </button>
          ) : (
            ([2, 3, 4] as const).map(n => (
              <button
                key={n}
                onClick={() => { onSetSplitMode?.(n); onClose(); }}
                style={{ pointerEvents: 'auto' }}
                className="w-7 h-7 rounded-md text-[11px] tabular-nums text-white/55
                  hover:text-white/90 hover:bg-white/[0.07] transition-colors text-center cursor-pointer"
              >
                {n}
              </button>
            ))
          )}
        </div>
      </div>

      <Divider />

      {/* ── Library ────────────────────────────────────────────────── */}
      <Row Icon={Bookmark} label="Bookmarks"  right={kbd('B')} onClick={() => go(() => onNavigate('web20://bookmarks'))}
        pinnableId="bookmarks"  pinned={isPinned('bookmarks')}  onTogglePin={() => pin('bookmarks')} />
      <Row Icon={History}  label="History"    right={kbd('H')} onClick={() => go(() => onNavigate('web20://history'))}
        pinnableId="history"    pinned={isPinned('history')}    onTogglePin={() => pin('history')} />
      <Row Icon={Download} label="Downloads"  right={kbd('J')} onClick={() => go(() => onNavigate('web20://downloads'))}
        pinnableId="downloads"  pinned={isPinned('downloads')}  onTogglePin={() => pin('downloads')} />
      <Row Icon={Puzzle}   label="Extensions"                  onClick={() => go(() => onNavigate('web20://extensions'))}
        pinnableId="extensions" pinned={isPinned('extensions')} onTogglePin={() => pin('extensions')} />

      <Divider />

      {/* ── App ────────────────────────────────────────────────────── */}
      <Row Icon={Settings} label="Settings"   onClick={() => go(() => onNavigate('web20://settings'))} />
      <Row Icon={User}     label="Profiles"   onClick={() => go(() => onNavigate('web20://profiles'))} />
      <Row Icon={Code2}    label="Injections" onClick={() => go(() => onNavigate('web20://injections'))} />

      <Divider />

      <Row Icon={LogOut} label="Quit" right={kbd('Q')} danger onClick={() => window.electronAPI?.close()} />
    </Shell>
  );
}

// ─── Add-site modal ───────────────────────────────────────────────────────────

interface AddSiteModalProps {
  open:    boolean;
  onClose: () => void;
  onAdd:   (name: string, url: string) => void;
}

export function AddSiteModal({ open, onClose, onAdd }: AddSiteModalProps) {
  const [name, setName] = useState("");
  const [url,  setUrl]  = useState("");
  const [err,  setErr]  = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(""); setUrl(""); setErr("");
      setTimeout(() => nameRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (!name.trim()) { setErr("Name is required."); return; }
    if (!url.trim())  { setErr("URL is required.");  return; }
    onAdd(name.trim(), url.trim());
    onClose();
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9100] flex items-center justify-center"
      onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[420px] rounded-2xl border border-white/10 bg-[#111]/96
        backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden animate-menu-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <span className="text-[13.5px] text-white/88">Add favorite site</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-white/[0.07] text-white/40 flex items-center justify-center transition-colors"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <ModalField ref={nameRef} label="Name" value={name} onChange={setName} placeholder="e.g. Linear" />
          <ModalField              label="URL"   value={url}  onChange={setUrl}  placeholder="https://linear.app" />
          {err && <p className="text-[11.5px] text-red-400/90">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="h-8 px-4 rounded-lg text-[12px] text-white/55 hover:bg-white/[0.05] transition-colors">Cancel</button>
            <button onClick={submit}  className="h-8 px-4 rounded-lg text-[12px] bg-white text-black hover:bg-white/90 transition-colors">Add site</button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

const ModalField = forwardRef<
  HTMLInputElement,
  { label: string; value: string; onChange: (v: string) => void; placeholder: string }
>(({ label, value, onChange, placeholder }, ref) => (
  <label className="block">
    <span className="text-[10.5px] tracking-wider uppercase text-white/36">{label}</span>
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1.5 w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.09]
        focus:border-white/[0.24] px-3 text-[13px] text-white placeholder:text-white/26
        outline-none transition-colors"
    />
  </label>
));
