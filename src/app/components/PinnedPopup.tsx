import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download, History, Bookmark, Puzzle, ArrowRight,
} from "lucide-react";
import type { HistoryEntry, Bookmark as BookmarkType, DownloadItem } from "../types";
import type { PinnableId } from "../services/pinnableActions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PinnedPopupProps {
  id:         PinnableId;
  anchor:     DOMRect;
  history:    HistoryEntry[];
  bookmarks:  BookmarkType[];
  downloads:  DownloadItem[];
  onNavigate: (url: string) => void;
  onClose:    () => void;
}

const TITLE: Partial<Record<PinnableId, string>> = {
  downloads:  'Downloads',
  history:    'History',
  bookmarks:  'Bookmarks',
  extensions: 'Extensions',
};

const ICON: Partial<Record<PinnableId, React.ComponentType<any>>> = {
  downloads:  Download,
  history:    History,
  bookmarks:  Bookmark,
  extensions: Puzzle,
};

const W = 274;

// ── Root popup ────────────────────────────────────────────────────────────────

export function PinnedPopup({ id, anchor, history, bookmarks, downloads, onNavigate, onClose }: PinnedPopupProps) {
  const ref   = useRef<HTMLDivElement>(null);
  const title = TITLE[id] ?? id;
  const Icon  = ICON[id];

  const top  = anchor.bottom + 6;
  const left = Math.min(Math.max(8, anchor.left - 10), window.innerWidth - W - 8);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const nav = (url: string) => { onNavigate(url); onClose(); };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9000]" onClick={onClose} />
      <div
        ref={ref}
        className="fixed z-[9001] animate-menu-in rounded-xl overflow-hidden
          border border-white/[0.1] bg-[#0F0F10]/97 backdrop-blur-2xl
          shadow-[0_20px_60px_rgba(0,0,0,0.72)]"
        style={{ top, left, width: W }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3.5 pt-3 pb-2.5 border-b border-white/[0.06]">
          {Icon && <Icon size={12} strokeWidth={1.75} className="text-white/38 shrink-0" />}
          <span className="text-[11.5px] text-white/55 font-medium tracking-wide">{title}</span>
        </div>

        {/* Content */}
        <div className="max-h-[240px] overflow-y-auto overflow-x-hidden">
          {id === 'downloads'  && <DownloadsContent  downloads={downloads}  nav={nav} />}
          {id === 'history'    && <HistoryContent    history={history}      nav={nav} />}
          {id === 'bookmarks'  && <BookmarksContent  bookmarks={bookmarks}  nav={nav} />}
          {id === 'extensions' && <ExtensionsContent nav={nav} />}
        </div>

        {/* Footer: open full page */}
        <div className="p-1.5 border-t border-white/[0.06]">
          <button
            onClick={() => nav(`web20://${id}`)}
            className="w-full flex items-center justify-between px-2.5 py-[7px] rounded-lg
              hover:bg-white/[0.06] transition-colors duration-100 cursor-pointer group"
          >
            <span className="text-[11.5px] text-white/40 group-hover:text-white/70 transition-colors">
              Open full {title}
            </span>
            <ArrowRight size={11} strokeWidth={1.75} className="text-white/25 group-hover:text-white/50 transition-colors" />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── Shared row ────────────────────────────────────────────────────────────────

function PopupRow({ icon, label, sub, onClick }: {
  icon?:    React.ReactNode;
  label:    string;
  sub?:     string;
  onClick:  () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3.5 py-[6px]
        hover:bg-white/[0.05] text-left transition-colors duration-75 cursor-pointer group"
    >
      <span className="shrink-0 text-white/28 w-3 flex items-center justify-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-white/68 truncate group-hover:text-white/88 transition-colors leading-snug">
          {label}
        </div>
        {sub && (
          <div className="text-[10.5px] text-white/28 truncate mt-px">{sub}</div>
        )}
      </div>
    </button>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="px-3.5 py-5 text-center text-[11px] text-white/22">{msg}</div>;
}

// ── Downloads ─────────────────────────────────────────────────────────────────

function DownloadsContent({ downloads, nav }: { downloads: DownloadItem[]; nav: (url: string) => void }) {
  const items = downloads.slice(0, 7);
  if (!items.length) return <Empty msg="No downloads yet" />;
  return (
    <div className="py-1">
      {items.map(dl => {
        const sub = dl.state === 'completed'
          ? formatBytes(dl.size)
          : dl.state === 'progressing' ? 'Downloading…' : dl.state;
        return (
          <PopupRow
            key={dl.id}
            icon={<Download size={11} strokeWidth={1.75} />}
            label={dl.filename}
            sub={sub}
            onClick={() => nav('web20://downloads')}
          />
        );
      })}
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────

function HistoryContent({ history, nav }: { history: HistoryEntry[]; nav: (url: string) => void }) {
  const items = history.slice(0, 7);
  if (!items.length) return <Empty msg="No history yet" />;
  return (
    <div className="py-1">
      {items.map(h => (
        <PopupRow
          key={h.id}
          icon={
            h.favicon
              ? <img src={h.favicon} className="w-3 h-3 object-contain rounded-sm" alt="" />
              : <History size={11} strokeWidth={1.75} />
          }
          label={h.title || h.url}
          sub={h.url}
          onClick={() => nav(h.url)}
        />
      ))}
    </div>
  );
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

function BookmarksContent({ bookmarks, nav }: { bookmarks: BookmarkType[]; nav: (url: string) => void }) {
  const items = bookmarks.slice(0, 7);
  if (!items.length) return <Empty msg="No bookmarks yet" />;
  return (
    <div className="py-1">
      {items.map(b => (
        <PopupRow
          key={b.id}
          icon={
            b.favicon
              ? <img src={b.favicon} className="w-3 h-3 object-contain rounded-sm" alt="" />
              : <Bookmark size={11} strokeWidth={1.75} />
          }
          label={b.title || b.url}
          sub={b.url}
          onClick={() => nav(b.url)}
        />
      ))}
    </div>
  );
}

// ── Extensions ────────────────────────────────────────────────────────────────

function ExtensionsContent({ nav }: { nav: (url: string) => void }) {
  const [exts,    setExts]    = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI?.listExtensions?.()
      .then(list => { setExts(list ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="px-3.5 py-5 text-center text-[11px] text-white/22">Loading…</div>;
  if (!exts.length) return <Empty msg="No extensions installed" />;

  return (
    <div className="py-1">
      {exts.slice(0, 7).map(ext => (
        <PopupRow
          key={ext.id}
          icon={<Puzzle size={11} strokeWidth={1.75} />}
          label={ext.name}
          sub={`v${ext.version}`}
          onClick={() => nav('web20://extensions')}
        />
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(n?: number): string | undefined {
  if (!n) return undefined;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
