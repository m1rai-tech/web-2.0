import React, { useState, useEffect, useRef } from "react";
import {
  Clock, Bookmark as BookmarkIcon, Download,
  Trash2, Moon, Shield, Search, Info,
  ExternalLink, X, Puzzle, FolderOpen, Package,
  User, Plus, Code2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from "lucide-react";
import { QuickAccess } from "./QuickAccess";
import type { Site, HistoryEntry, Bookmark, DownloadItem } from "../types";
import type { Profile } from "../services/profiles";
import { BUILT_IN_PROFILES, PROFILE_COLORS, createProfile, saveProfiles, saveActiveProfileId } from "../services/profiles";
import type { Injection } from "../services/injections";
import { saveInjections, matchesUrl as _matchesUrl } from "../services/injections";

interface InternalPagesProps {
  page: string;
  sites: Site[];
  history: HistoryEntry[];
  bookmarks: Bookmark[];
  downloads: DownloadItem[];
  onNavigate: (url: string) => void;
  onOpenManager: () => void;
  onRemoveSite: (id: string) => void;
  onEditSite: (id: string, name: string, url: string) => void;
  onOpenBookmark: (url: string) => void;
  onRemoveBookmark: (id: string) => void;
  onClearHistory: () => void;
  onClearBookmarks: () => void;
  onClearDownloads: () => void;
  // Profiles
  profiles?: Profile[];
  activeProfileId?: string;
  onSwitchProfile?: (id: string) => void;
  onProfilesChange?: (profiles: Profile[]) => void;
  // Injections
  injections?: Injection[];
  onInjectionsChange?: (injections: Injection[]) => void;
}

export function InternalPages(props: InternalPagesProps) {
  const { page } = props;

  if (page === 'start') return <StartHub {...props} />;
  if (page === 'history') return <HistoryPage {...props} />;
  if (page === 'bookmarks') return <BookmarksPage {...props} />;
  if (page === 'downloads') return <DownloadsPage {...props} />;
  if (page === 'settings') return <SettingsPage {...props} />;
  if (page === 'extensions') return <ExtensionsPage onNavigate={props.onNavigate} />;
  if (page === 'profiles') return <ProfilesPage {...props} />;
  if (page === 'injections') return <InjectionsPage {...props} />;
  return <StartHub {...props} />;
}

// ── StartHub ─────────────────────────────────────────────────────────────────

function StartHub({ sites, onNavigate, onOpenManager, onRemoveSite, onEditSite }: InternalPagesProps) {
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 });
  const [dragging,  setDragging]  = useState(false);
  const mainRef    = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isElectron = !!window.electronAPI?.isElectron;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = mainRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSpotlight({
        x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
        y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const val = (e.target as HTMLInputElement).value.trim();
    if (!val) return;
    (e.target as HTMLInputElement).value = '';
    onNavigate(val);
  };

  // Custom window drag — fires when pressing on the empty background
  const handleBgMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !isElectron) return;
    // Skip if the click landed inside the interactive content area
    if (contentRef.current?.contains(e.target as Node)) return;

    setDragging(true);
    let lastX = e.screenX;
    let lastY = e.screenY;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.screenX - lastX;
      const dy = ev.screenY - lastY;
      lastX = ev.screenX;
      lastY = ev.screenY;
      if (dx !== 0 || dy !== 0) window.electronAPI?.moveWindowBy(dx, dy);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',  onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',  onUp);
  };

  return (
    <div
      ref={mainRef}
      className="absolute inset-0 flex flex-col items-center justify-center px-12 overflow-hidden select-none"
      style={{ cursor: isElectron ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      onMouseDown={handleBgMouseDown}
    >
      {/* Spotlight */}
      <div
        className="absolute inset-0 pointer-events-none z-0 transition-[background] duration-700"
        style={{
          background: `radial-gradient(280px circle at ${spotlight.x}% ${spotlight.y}%, rgba(255,255,255,0.03), transparent 70%)`,
        }}
      />

      <div
        ref={contentRef}
        className="relative z-10 w-full flex flex-col items-center -mt-24"
        style={{ cursor: 'default' }}
      >
        <span className="text-[10px] tracking-[0.32em] text-white/26 uppercase select-none">
          Start Hub
        </span>

        <h1
          className="mt-3 text-white tracking-tight select-none"
          style={{ fontSize: 48, lineHeight: 1.07 }}
        >
          Web 2.0
        </h1>

        <p className="mt-3.5 text-[13px] text-white/36 max-w-[320px] leading-relaxed text-center">
          Calm browsing for focused work, research, and everyday search.
        </p>

        {/* Search bar */}
        <div className="mt-7 w-full max-w-[580px]">
          <div
            className="group/search h-[48px] rounded-xl
              bg-white/[0.036] border border-white/[0.08]
              hover:border-white/[0.15] hover:-translate-y-[1.5px]
              hover:bg-white/[0.048]
              hover:shadow-[0_6px_24px_rgba(0,0,0,0.26),0_0_0_1px_rgba(255,255,255,0.04)]
              focus-within:border-white/[0.21] focus-within:bg-white/[0.058]
              focus-within:-translate-y-[1.5px]
              focus-within:shadow-[0_8px_32px_rgba(0,0,0,0.30),0_0_0_3px_rgba(255,255,255,0.038)]
              flex items-center px-5
              transition-all duration-250 backdrop-blur-xl"
          >
            <input
              placeholder="Search or enter address"
              className="flex-1 bg-transparent outline-none text-[14px] text-white
                placeholder:text-white/28 min-w-0"
              onKeyDown={handleSearch}
            />
            <Search size={15} strokeWidth={1.5} className="ml-3 shrink-0 text-white/22 pointer-events-none" />
          </div>
        </div>

        {/* Favorite sites */}
        <div className="mt-9 w-full flex justify-center">
          <QuickAccess
            sites={sites}
            onOpenManager={onOpenManager}
            onRemove={onRemoveSite}
            onEdit={onEditSite}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </div>
  );
}

// ── Shared page shell ─────────────────────────────────────────────────────────

function PageShell({ title, children, action }: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex items-center justify-between px-8 pt-8 pb-5 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <h2 className="text-[22px] text-white/88 tracking-tight">{title}</h2>
        {action}
      </div>
      <div
        className="flex-1 overflow-y-auto px-8 pb-8"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

function EmptyState({ Icon, label, hint }: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06]
        flex items-center justify-center text-white/20">
        <Icon size={24} strokeWidth={1.25} />
      </div>
      <div className="text-[14px] text-white/45">{label}</div>
      {hint && <div className="text-[12px] text-white/28 text-center max-w-[240px] leading-relaxed">{hint}</div>}
    </div>
  );
}

// ── History page ──────────────────────────────────────────────────────────────

function HistoryPage({ history, onNavigate, onClearHistory }: InternalPagesProps) {
  const entries = Array.isArray(history) ? history : [];

  const grouped = entries.reduce<Record<string, HistoryEntry[]>>((acc, entry) => {
    const d = new Date(entry.visitedAt);
    const key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <PageShell
      title="History"
      action={
        entries.length > 0 ? (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px]
              text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]
              border border-white/[0.07] transition-all duration-150"
          >
            <Trash2 size={12} strokeWidth={1.75} />
            Clear all
          </button>
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <EmptyState Icon={Clock} label="No history yet" hint="Pages you visit will appear here." />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="text-[10px] tracking-[0.24em] uppercase text-white/30 mb-2">
                {date}
              </div>
              <div className="space-y-0.5">
                {items.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} onOpen={() => onNavigate(entry.url)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function HistoryRow({ entry, onOpen }: { entry: HistoryEntry; onOpen: () => void }) {
  const domain = entry.url.replace(/^https?:\/\//, '').split('/')[0];
  const faviconSrc = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  const time = new Date(entry.visitedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
        hover:bg-white/[0.04] text-left transition-colors duration-100 group"
    >
      <div className="w-5 h-5 shrink-0 rounded overflow-hidden flex items-center justify-center">
        <img
          src={faviconSrc}
          alt=""
          width={16}
          height={16}
          className="w-4 h-4 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white/75 truncate group-hover:text-white/92 transition-colors">
          {entry.title || entry.url}
        </div>
        <div className="text-[11px] text-white/30 truncate mt-0.5">{entry.url}</div>
      </div>
      <div className="text-[11px] text-white/28 shrink-0 tabular-nums">{time}</div>
      <ExternalLink size={12} className="text-white/20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── Bookmarks page ────────────────────────────────────────────────────────────

function BookmarksPage({ bookmarks, onOpenBookmark, onRemoveBookmark, onClearBookmarks }: InternalPagesProps) {
  const items = Array.isArray(bookmarks) ? bookmarks : [];

  return (
    <PageShell
      title="Bookmarks"
      action={
        items.length > 0 ? (
          <button
            onClick={onClearBookmarks}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px]
              text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]
              border border-white/[0.07] transition-all duration-150"
          >
            <Trash2 size={12} strokeWidth={1.75} />
            Clear all
          </button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState
          Icon={BookmarkIcon}
          label="No bookmarks yet"
          hint="Click the bookmark icon in the address bar to save pages."
        />
      ) : (
        <div className="space-y-0.5">
          {items.map((bm) => (
            <BookmarkRow
              key={bm.id}
              bookmark={bm}
              onOpen={() => onOpenBookmark(bm.url)}
              onRemove={() => onRemoveBookmark(bm.id)}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function BookmarkRow({ bookmark, onOpen, onRemove }: {
  bookmark: Bookmark;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const domain = bookmark.url.replace(/^https?:\/\//, '').split('/')[0];
  const faviconSrc = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  const date = new Date(bookmark.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors">
      <button onClick={onOpen} className="flex-1 flex items-center gap-3 text-left min-w-0">
        <div className="w-5 h-5 shrink-0">
          <img
            src={faviconSrc}
            alt=""
            width={16}
            height={16}
            className="w-4 h-4 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-white/75 truncate group-hover:text-white/92 transition-colors">
            {bookmark.title || bookmark.url}
          </div>
          <div className="text-[11px] text-white/30 truncate mt-0.5">{bookmark.url}</div>
        </div>
        <div className="text-[11px] text-white/28 shrink-0">{date}</div>
      </button>
      <button
        onClick={onRemove}
        className="w-7 h-7 rounded-md flex items-center justify-center
          text-white/28 hover:text-red-400/80 hover:bg-red-500/[0.08]
          opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0"
      >
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Downloads page ────────────────────────────────────────────────────────────

function DownloadsPage({ downloads, onClearDownloads }: InternalPagesProps) {
  const items = Array.isArray(downloads) ? downloads : [];

  return (
    <PageShell
      title="Downloads"
      action={
        items.length > 0 ? (
          <button
            onClick={onClearDownloads}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px]
              text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.08]
              border border-white/[0.07] transition-all duration-150"
          >
            <Trash2 size={12} strokeWidth={1.75} />
            Clear all
          </button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState
          Icon={Download}
          label="No downloads yet"
          hint="Files you download will appear here."
        />
      ) : (
        <div className="space-y-0.5">
          {items.map((item) => (
            <DownloadRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function DownloadRow({ item }: { item: DownloadItem }) {
  const fmt = (n: number) =>
    n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;

  const isProgress = item.state === 'progressing';
  const progress   = (item.size && item.receivedBytes != null)
    ? Math.min(1, item.receivedBytes / item.size) : null;

  const stateLabel = isProgress
    ? (progress != null ? `${(progress * 100).toFixed(0)}%${item.size ? ` of ${fmt(item.size)}` : ''}` : 'Downloading…')
    : item.state === 'completed' ? (item.size ? fmt(item.size) : 'Done')
    : item.state;

  const stateColor = item.state === 'completed'
    ? 'text-white/45'
    : isProgress ? 'text-blue-400/70'
    : 'text-amber-400/70';

  const date = new Date(item.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors">
      <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.07]
        flex items-center justify-center text-white/40 shrink-0">
        <Download size={14} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white/75 truncate">{item.filename}</div>
        {isProgress && progress != null ? (
          <div className="mt-1.5 h-[3px] rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500/70 transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        ) : (
          <div className={`text-[11px] mt-0.5 ${stateColor}`}>{stateLabel}</div>
        )}
        {isProgress && (
          <div className={`text-[10px] mt-0.5 ${stateColor}`}>{stateLabel}</div>
        )}
      </div>
      {!isProgress && <div className="text-[11px] text-white/28 shrink-0">{date}</div>}
    </div>
  );
}

// ── Settings page ─────────────────────────────────────────────────────────────

function SettingsPage({ onClearHistory, onClearBookmarks, onClearDownloads }: InternalPagesProps) {
  const [searchEngine, setSearchEngine] = useState(() => {
    try { return localStorage.getItem('w2_searchEngine') || 'google'; } catch { return 'google'; }
  });
  const [privacyMode, setPrivacyMode] = useState<'off' | 'balanced' | 'strict'>(() => {
    try { return (localStorage.getItem('w2_privacy') as any) || 'balanced'; } catch { return 'balanced'; }
  });

  const setEngine = (v: string) => {
    setSearchEngine(v);
    try { localStorage.setItem('w2_searchEngine', v); } catch {}
  };

  const setPrivacy = (v: 'off' | 'balanced' | 'strict') => {
    setPrivacyMode(v);
    try { localStorage.setItem('w2_privacy', v); } catch {}
  };

  return (
    <PageShell title="Settings">
      <div className="max-w-[560px] space-y-2">

        {/* Appearance */}
        <Section title="Appearance">
          <SettingRow label="Theme" hint="Dark · Graphite">
            <div className="flex items-center gap-1.5 text-[11.5px] text-white/45 bg-white/[0.04]
              border border-white/[0.07] px-3 py-1.5 rounded-lg">
              <Moon size={12} strokeWidth={1.75} />
              Dark
            </div>
          </SettingRow>
        </Section>

        {/* Search engine */}
        <Section title="Search">
          <SettingRow label="Default search engine" hint="Used when typing in the address bar">
            <div className="flex items-center gap-1">
              {(['google', 'duckduckgo', 'bing'] as const).map(engine => (
                <button
                  key={engine}
                  onClick={() => setEngine(engine)}
                  className={`h-7 px-3 rounded-md text-[11.5px] capitalize transition-all duration-150
                    ${searchEngine === engine
                      ? 'bg-white/[0.1] text-white/90 border border-white/[0.12]'
                      : 'text-white/45 hover:text-white/70 hover:bg-white/[0.05]'
                    }`}
                >
                  {engine === 'duckduckgo' ? 'DuckDuckGo' : engine.charAt(0).toUpperCase() + engine.slice(1)}
                </button>
              ))}
            </div>
          </SettingRow>
        </Section>

        {/* Privacy */}
        <Section title="Privacy Shield">
          <SettingRow label="Tracking protection" hint="Controls how aggressive the privacy shield is">
            <div className="flex items-center gap-1">
              {(['off', 'balanced', 'strict'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setPrivacy(mode)}
                  className={`h-7 px-3 rounded-md text-[11.5px] capitalize transition-all duration-150
                    ${privacyMode === mode
                      ? 'bg-white/[0.1] text-white/90 border border-white/[0.12]'
                      : 'text-white/45 hover:text-white/70 hover:bg-white/[0.05]'
                    }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </SettingRow>
        </Section>

        {/* Clear data */}
        <Section title="Clear Data">
          <SettingRow label="Browsing history" hint="All visited pages">
            <DangerBtn onClick={onClearHistory} label="Clear" />
          </SettingRow>
          <SettingRow label="Bookmarks" hint="All saved bookmarks">
            <DangerBtn onClick={onClearBookmarks} label="Clear" />
          </SettingRow>
          <SettingRow label="Downloads" hint="Download history">
            <DangerBtn onClick={onClearDownloads} label="Clear" />
          </SettingRow>
        </Section>

        {/* About */}
        <Section title="About">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08]
              flex items-center justify-center">
              <Info size={15} strokeWidth={1.75} className="text-white/50" />
            </div>
            <div>
              <div className="text-[13px] text-white/80">Web 2.0</div>
              <div className="text-[11px] text-white/35 mt-0.5">Version 1.0.0 · Electron Browser</div>
            </div>
          </div>
        </Section>
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/[0.05]
        text-[10px] tracking-[0.22em] uppercase text-white/30">
        {title}
      </div>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </div>
  );
}

function SettingRow({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <div>
        <div className="text-[13px] text-white/75">{label}</div>
        {hint && <div className="text-[11px] text-white/35 mt-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function DangerBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="h-7 px-3.5 rounded-lg text-[12px] text-red-400/70 hover:text-red-400
        hover:bg-red-500/[0.08] border border-white/[0.07]
        transition-all duration-150"
    >
      {label}
    </button>
  );
}

// ── Extensions page ───────────────────────────────────────────────────────────

function ExtensionsPage({ onNavigate }: { onNavigate: (url: string) => void }) {
  const [exts, setExts] = useState<ExtensionInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const isElectron = !!window.electronAPI?.isElectron;

  const refresh = () => {
    window.electronAPI?.listExtensions?.().then(list => setExts(list ?? []));
  };

  useEffect(() => { refresh(); }, []);

  const handleLoad = async () => {
    setBusy(true);
    try {
      const p = await window.electronAPI?.showExtensionFolderDialog?.();
      if (p) {
        await window.electronAPI?.loadExtension?.(p);
        refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: string) => {
    await window.electronAPI?.removeExtension?.(id);
    refresh();
  };

  return (
    <PageShell
      title="Extensions"
      action={
        isElectron ? (
          <button
            onClick={handleLoad}
            disabled={busy}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px]
              text-white/60 hover:text-white/90 hover:bg-white/[0.06]
              border border-white/[0.07] transition-all duration-150
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FolderOpen size={12} strokeWidth={1.75} />
            {busy ? 'Loading…' : 'Load unpacked'}
          </button>
        ) : undefined
      }
    >
      <div className="max-w-[640px] space-y-4">
        {/* Chrome Web Store banner */}
        <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl
          border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
          <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08]
            flex items-center justify-center shrink-0">
            <Package size={16} strokeWidth={1.5} className="text-white/50" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-white/80">Chrome Web Store</div>
            <div className="text-[11px] text-white/35 mt-0.5">
              Browse thousands of extensions — download the .crx and load unpacked.
            </div>
          </div>
          <button
            onClick={() => onNavigate('https://chromewebstore.google.com')}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11.5px]
              text-white/55 hover:text-white/90 hover:bg-white/[0.07]
              border border-white/[0.07] transition-all duration-150 shrink-0"
          >
            Open
            <ExternalLink size={11} strokeWidth={1.75} />
          </button>
        </div>

        {/* Installed list */}
        {!isElectron ? (
          <EmptyState
            Icon={Puzzle}
            label="Extensions require Electron"
            hint="Run the app via npm start to manage extensions."
          />
        ) : exts.length === 0 ? (
          <EmptyState
            Icon={Puzzle}
            label="No extensions installed"
            hint={'Click “Load unpacked” to install an extension from a local folder.'}
          />
        ) : (
          <div>
            <div className="text-[10px] tracking-[0.24em] uppercase text-white/30 mb-2 px-1">
              Installed ({exts.length})
            </div>
            <div className="space-y-0.5">
              {exts.map(ext => (
                <ExtensionRow key={ext.id} ext={ext} onRemove={() => handleRemove(ext.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ExtensionRow({ ext, onRemove }: { ext: ExtensionInfo; onRemove: () => void }) {
  const [confirm, setConfirm] = useState(false);

  const handleRemove = () => {
    if (confirm) { onRemove(); }
    else { setConfirm(true); setTimeout(() => setConfirm(false), 2500); }
  };

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg
      hover:bg-white/[0.04] transition-colors">
      <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.07]
        flex items-center justify-center text-white/40 shrink-0">
        <Puzzle size={14} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white/75 truncate">{ext.name}</div>
        <div className="text-[11px] text-white/30 mt-0.5 truncate">
          v{ext.version} · {ext.id}
        </div>
      </div>
      <button
        onClick={handleRemove}
        className={`h-7 px-2.5 rounded-md text-[11px] border transition-all duration-150
          opacity-0 group-hover:opacity-100 shrink-0
          ${confirm
            ? 'text-red-400 border-red-500/30 bg-red-500/[0.08] opacity-100'
            : 'text-white/40 border-white/[0.07] hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/[0.08]'
          }`}
      >
        {confirm ? 'Confirm' : 'Remove'}
      </button>
    </div>
  );
}

// ── Profiles page ─────────────────────────────────────────────────────────────

function ProfilesPage({ profiles = [], activeProfileId = 'default', onSwitchProfile, onProfilesChange }: InternalPagesProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newColor,   setNewColor]   = useState(PROFILE_COLORS[1]);

  const builtInIds = new Set(BUILT_IN_PROFILES.map(p => p.id));

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const p = createProfile(name, newColor);
    const next = [...profiles, p];
    saveProfiles(next);
    onProfilesChange?.(next);
    setNewName('');
    setNewColor(PROFILE_COLORS[1]);
    setShowCreate(false);
  };

  const handleDelete = (id: string) => {
    const next = profiles.filter(p => p.id !== id);
    saveProfiles(next);
    onProfilesChange?.(next);
    if (activeProfileId === id) {
      saveActiveProfileId('default');
      onSwitchProfile?.('default');
    }
  };

  const handleActivate = (id: string) => {
    saveActiveProfileId(id);
    onSwitchProfile?.(id);
  };

  return (
    <PageShell
      title="Profiles"
      action={
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px]
            text-white/60 hover:text-white/90 hover:bg-white/[0.06]
            border border-white/[0.07] transition-all duration-150"
        >
          <Plus size={12} strokeWidth={2} />
          New profile
        </button>
      }
    >
      <div className="max-w-[560px] space-y-3">

        {/* Create form */}
        {showCreate && (
          <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 space-y-3">
            <div className="text-[11px] tracking-[0.2em] uppercase text-white/35">New profile</div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
              placeholder="Profile name"
              autoFocus
              className="w-full h-8 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08]
                text-[13px] text-white/80 placeholder:text-white/28
                outline-none focus:border-white/[0.22] transition-colors"
            />
            <div className="flex gap-1.5 flex-wrap">
              {PROFILE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className="w-5 h-5 rounded-full transition-transform"
                  style={{
                    background: c,
                    transform: newColor === c ? 'scale(1.25)' : 'scale(1)',
                    outline: newColor === c ? `2px solid ${c}` : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="h-7 px-4 rounded-lg text-[12px] bg-white/[0.08] text-white/80
                  hover:bg-white/[0.12] border border-white/[0.1] transition-all
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="h-7 px-3 rounded-lg text-[12px] text-white/40
                  hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Profile list */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {profiles.map(p => {
              const isActive   = p.id === activeProfileId;
              const isBuiltIn  = builtInIds.has(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 group">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: p.color + '22', border: `1.5px solid ${p.color}55` }}
                  >
                    <User size={14} strokeWidth={1.75} style={{ color: p.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-white/80">{p.name}</div>
                    <div className="text-[11px] text-white/30 mt-0.5">
                      {p.partition || 'Default session'}
                    </div>
                  </div>
                  {isActive && (
                    <div className="h-5 px-2 rounded-full bg-white/[0.07] border border-white/[0.1]
                      text-[10px] text-white/55 flex items-center">
                      Active
                    </div>
                  )}
                  {!isActive && (
                    <button
                      onClick={() => handleActivate(p.id)}
                      className="h-7 px-3 rounded-lg text-[11.5px] text-white/45
                        hover:text-white/80 hover:bg-white/[0.06] border border-white/[0.07]
                        transition-all duration-150 opacity-0 group-hover:opacity-100"
                    >
                      Activate
                    </button>
                  )}
                  {!isBuiltIn && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="w-7 h-7 rounded-md flex items-center justify-center
                        text-white/25 hover:text-red-400/80 hover:bg-red-500/[0.08]
                        opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0"
                    >
                      <X size={13} strokeWidth={2} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-white/28 leading-relaxed px-1">
          Each profile has its own cookies, storage, and login sessions.
          New tabs inherit the active profile. Switching profiles only affects new tabs.
        </p>
      </div>
    </PageShell>
  );
}

// ── Injections page ───────────────────────────────────────────────────────────

function InjectionsPage({ injections = [], onInjectionsChange }: InternalPagesProps) {
  const [items, setItems] = useState<Injection[]>(injections);
  const [editing,   setEditing]   = useState<string | null>(null); // id or 'new'
  const [editState, setEditState] = useState<Partial<Injection>>({});

  // Keep in sync if parent updates (e.g. hot reload)
  useEffect(() => { setItems(injections); }, [injections]);

  const commit = (next: Injection[]) => {
    setItems(next);
    saveInjections(next);
    onInjectionsChange?.(next);
  };

  const openNew = () => {
    setEditState({ name: '', urlPattern: '', css: '', js: '', enabled: true });
    setEditing('new');
  };

  const openEdit = (inj: Injection) => {
    setEditState({ ...inj });
    setEditing(inj.id);
  };

  const saveEdit = () => {
    if (!editState.urlPattern?.trim()) return;
    if (editing === 'new') {
      const inj: Injection = {
        id: `inj_${Date.now()}`,
        name:       editState.name       ?? '',
        urlPattern: editState.urlPattern ?? '',
        css:        editState.css        ?? '',
        js:         editState.js         ?? '',
        enabled:    editState.enabled    ?? true,
      };
      commit([...items, inj]);
    } else {
      commit(items.map(i => i.id === editing ? { ...i, ...editState } as Injection : i));
    }
    setEditing(null);
  };

  const cancelEdit = () => setEditing(null);

  const toggleEnabled = (id: string) => {
    commit(items.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i));
  };

  const deleteInj = (id: string) => {
    commit(items.filter(i => i.id !== id));
    if (editing === id) setEditing(null);
  };

  return (
    <PageShell
      title="CSS / JS Injection"
      action={
        editing !== 'new' ? (
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[12px]
              text-white/60 hover:text-white/90 hover:bg-white/[0.06]
              border border-white/[0.07] transition-all duration-150"
          >
            <Plus size={12} strokeWidth={2} />
            Add injection
          </button>
        ) : undefined
      }
    >
      <div className="max-w-[640px] space-y-2">

        {/* Inline create form */}
        {editing === 'new' && (
          <InjectionEditor
            state={editState}
            onChange={setEditState}
            onSave={saveEdit}
            onCancel={cancelEdit}
          />
        )}

        {items.length === 0 && editing !== 'new' ? (
          <EmptyState
            Icon={Code2}
            label="No injections yet"
            hint={'Click "Add injection" to run custom CSS or JS on any site.'}
          />
        ) : (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="divide-y divide-white/[0.04]">
              {items.map(inj => (
                <React.Fragment key={inj.id}>
                  <div className="flex items-center gap-3 px-4 py-3 group">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleEnabled(inj.id)}
                      className="shrink-0 transition-colors"
                      style={{ color: inj.enabled ? '#10A37F' : 'rgba(255,255,255,0.25)' }}
                    >
                      {inj.enabled
                        ? <ToggleRight size={20} strokeWidth={1.5} />
                        : <ToggleLeft  size={20} strokeWidth={1.5} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-white/80 truncate">
                        {inj.name || <span className="text-white/35 italic">Unnamed</span>}
                      </div>
                      <div className="text-[11px] text-white/32 truncate mt-0.5 font-mono">
                        {inj.urlPattern}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {inj.css && (
                        <div className="h-4 px-1.5 rounded bg-blue-500/20 text-blue-400/70 text-[9px] font-mono">CSS</div>
                      )}
                      {inj.js && (
                        <div className="h-4 px-1.5 rounded bg-yellow-500/20 text-yellow-400/70 text-[9px] font-mono">JS</div>
                      )}
                      <button
                        onClick={() => editing === inj.id ? cancelEdit() : openEdit(inj)}
                        className="h-7 px-2.5 rounded-md text-[11px] text-white/40
                          hover:text-white/80 hover:bg-white/[0.06] border border-white/[0.07]
                          transition-all duration-150 ml-1"
                      >
                        {editing === inj.id ? 'Close' : 'Edit'}
                      </button>
                      <button
                        onClick={() => deleteInj(inj.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center
                          text-white/25 hover:text-red-400/80 hover:bg-red-500/[0.08]
                          transition-all duration-150 shrink-0"
                      >
                        <X size={13} strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  {/* Inline editor */}
                  {editing === inj.id && (
                    <div className="px-4 pb-4 pt-1 bg-white/[0.015]">
                      <InjectionEditor
                        state={editState}
                        onChange={setEditState}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-white/28 leading-relaxed px-1">
          CSS and JS run on every page load that matches the URL pattern.
          Use <span className="font-mono text-white/45">*</span> as a wildcard —
          e.g. <span className="font-mono text-white/45">https://github.com/*</span>
        </p>
      </div>
    </PageShell>
  );
}

function InjectionEditor({ state, onChange, onSave, onCancel }: {
  state:    Partial<Injection>;
  onChange: (s: Partial<Injection>) => void;
  onSave:   () => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<'css' | 'js'>('css');

  const field = (placeholder: string, key: keyof Injection, value: string) => (
    <input
      value={value}
      onChange={(e) => onChange({ ...state, [key]: e.target.value })}
      placeholder={placeholder}
      className="w-full h-8 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08]
        text-[13px] text-white/80 placeholder:text-white/28
        outline-none focus:border-white/[0.22] transition-colors"
    />
  );

  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-2 gap-2">
        {field('Name (optional)', 'name', state.name ?? '')}
        {field('URL pattern, e.g. https://github.com/*', 'urlPattern', state.urlPattern ?? '')}
      </div>

      {/* CSS / JS tab switcher */}
      <div className="flex gap-1 text-[11.5px]">
        {(['css', 'js'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-6 px-3 rounded-md font-mono transition-all duration-150
              ${tab === t
                ? 'bg-white/[0.09] text-white/80 border border-white/[0.12]'
                : 'text-white/40 hover:text-white/70'}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <textarea
        value={tab === 'css' ? (state.css ?? '') : (state.js ?? '')}
        onChange={(e) => onChange({ ...state, [tab]: e.target.value })}
        placeholder={tab === 'css'
          ? '/* CSS to inject */\nbody { background: #111 !important; }'
          : '// JavaScript to run after page load\nconsole.log("Injected!");'}
        rows={6}
        spellCheck={false}
        className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
          text-[12px] font-mono text-white/75 placeholder:text-white/25
          outline-none focus:border-white/[0.2] transition-colors resize-none"
      />

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={!state.urlPattern?.trim()}
          className="h-7 px-4 rounded-lg text-[12px] bg-white/[0.08] text-white/80
            hover:bg-white/[0.12] border border-white/[0.1] transition-all
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="h-7 px-3 rounded-lg text-[12px] text-white/40 hover:text-white/70 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
