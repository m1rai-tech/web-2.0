import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy, Scissors, Clipboard, RotateCcw, RotateCw,
  Search, ExternalLink, Link2, ChevronRight,
  ArrowLeft, ArrowRight, RefreshCw, Code2, Eye,
  Camera, Download, Maximize2, Repeat, Film,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  params:       ContextMenuParams;
  onClose:      () => void;
  onOpenTab:    (url: string) => void;
  onScreenshot: () => void;
}

interface ItemDef {
  id:       string;
  label:    string;
  Icon?:    React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  action?:  () => void;
  disabled?: boolean;
  submenu?: ItemDef[];
}

type Row = ItemDef | null; // null = separator

// ── Menu item component ────────────────────────────────────────────────────────

interface ItemProps {
  item:        ItemDef;
  isHighlight: boolean;
  submenuOpen: boolean;
  onHover:     (id: string, hasSubmenu: boolean) => void;
  onLeave:     () => void;
  onCommit:    () => void;
}

function MenuItem({ item, isHighlight, submenuOpen, onHover, onLeave, onCommit }: ItemProps) {
  const hasSubmenu = !!item.submenu?.length;

  return (
    <div className="relative px-1">
      <button
        disabled={item.disabled}
        onMouseEnter={() => onHover(item.id, hasSubmenu)}
        onMouseLeave={onLeave}
        onClick={onCommit}
        className={[
          'w-full flex items-center gap-2 h-8 px-2.5 rounded-lg',
          'text-[13px] text-left transition-colors duration-75 cursor-default',
          item.disabled
            ? 'opacity-35 pointer-events-none text-white/55'
            : (isHighlight || submenuOpen)
              ? 'bg-white/[0.07] text-white'
              : 'text-white/78 hover:bg-white/[0.06] hover:text-white/92',
        ].join(' ')}
      >
        {item.Icon && (
          <item.Icon size={13} strokeWidth={1.6} className="shrink-0 text-white/45" />
        )}
        <span className="flex-1 truncate">{item.label}</span>
        {hasSubmenu && <ChevronRight size={11} strokeWidth={1.8} className="shrink-0 text-white/30" />}
      </button>

      {/* Submenu */}
      {hasSubmenu && submenuOpen && item.submenu && (
        <SubmenuPanel items={item.submenu} />
      )}
    </div>
  );
}

// ── Submenu panel ──────────────────────────────────────────────────────────────

function SubmenuPanel({ items }: { items: ItemDef[] }) {
  return (
    <div
      className={[
        'absolute top-0 left-full ml-1 py-1',
        'bg-[#141416] border border-white/[0.08]',
        'rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.72)]',
        'min-w-[160px] z-[9210]',
      ].join(' ')}
    >
      {items.map(sub => (
        <div key={sub.id} className="px-1">
          <button
            onClick={sub.action}
            className={[
              'w-full flex items-center gap-2 h-8 px-2.5 rounded-lg',
              'text-[13px] text-left cursor-default transition-colors duration-75',
              'text-white/78 hover:bg-white/[0.06] hover:text-white/92',
            ].join(' ')}
          >
            {sub.Icon && <sub.Icon size={13} strokeWidth={1.6} className="shrink-0 text-white/45" />}
            <span className="flex-1 truncate">{sub.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ContextMenu({ params, onClose, onOpenTab, onScreenshot }: Props) {
  const menuRef     = useRef<HTMLDivElement>(null);
  const openTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pos,          setPos]          = useState({ x: params.x, y: params.y });
  const [visible,      setVisible]      = useState(false);
  const [activeIdx,    setActiveIdx]    = useState(-1);
  const [openSubmenu,  setOpenSubmenu]  = useState<string | null>(null);

  // ── Action helpers ───────────────────────────────────────────────────────────
  const mainAction = useCallback((action: string, payload?: Record<string, unknown>) => {
    window.electronAPI?.contextMenuAction(action, params.wcId, payload);
    onClose();
  }, [params.wcId, onClose]);

  const copyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    onClose();
  }, [onClose]);

  const openTab = useCallback((url: string) => {
    onOpenTab(url);
    onClose();
  }, [onOpenTab, onClose]);

  // ── Build rows ───────────────────────────────────────────────────────────────
  const sections: ItemDef[][] = [];
  const ef = params.editFlags || {} as ContextMenuParams['editFlags'];

  // Editable section
  if (params.isEditable) {
    const items: ItemDef[] = [];
    if (ef.canUndo) items.push({ id: 'undo', label: 'Undo', Icon: RotateCcw, action: () => mainAction('undo') });
    if (ef.canRedo) items.push({ id: 'redo', label: 'Redo', Icon: RotateCw,  action: () => mainAction('redo') });
    items.push(
      { id: 'cut',  label: 'Cut',  Icon: Scissors,  disabled: !ef.canCut,  action: () => mainAction('cut') },
      { id: 'copy', label: 'Copy', Icon: Copy,       disabled: !ef.canCopy, action: () => mainAction('copy') },
      { id: 'paste',label: 'Paste',Icon: Clipboard,  disabled: !ef.canPaste,action: () => mainAction('paste') },
    );
    if (ef.canSelectAll) {
      items.push({ id: 'selectAll', label: 'Select All', action: () => mainAction('selectAll') });
    }
    sections.push(items);
  }

  // Selection (non-editable)
  if (params.selectionText && !params.isEditable) {
    const raw = params.selectionText;
    const preview = raw.length > 30 ? raw.slice(0, 30) + '…' : raw;
    sections.push([
      { id: 'copy-sel', label: 'Copy', Icon: Copy, action: () => copyText(raw) },
      {
        id: 'search', label: `Search for "${preview}"`, Icon: Search,
        submenu: [
          { id: 'sg',   label: 'Google',     Icon: Search, action: () => openTab(`https://www.google.com/search?q=${encodeURIComponent(raw)}`) },
          { id: 'sddg', label: 'DuckDuckGo', Icon: Search, action: () => openTab(`https://duckduckgo.com/?q=${encodeURIComponent(raw)}`) },
          { id: 'sbing',label: 'Bing',       Icon: Search, action: () => openTab(`https://www.bing.com/search?q=${encodeURIComponent(raw)}`) },
        ],
      },
    ]);
  }

  // Link section
  if (params.linkURL) {
    const lurl = params.linkURL;
    const ltext = params.linkText || lurl;
    sections.push([
      { id: 'open-link',    label: 'Open in New Tab',   Icon: ExternalLink, action: () => openTab(lurl) },
      { id: 'copy-link',    label: 'Copy Link',          Icon: Link2,        action: () => copyText(lurl) },
      { id: 'copy-link-md', label: 'Copy as Markdown',   Icon: Link2,        action: () => copyText(`[${ltext}](${lurl})`) },
    ]);
  }

  // Image section
  if (params.mediaType === 'image' || params.hasImageContents) {
    const items: ItemDef[] = [
      { id: 'save-img', label: 'Save Image',           Icon: Download,     action: () => mainAction('saveImage', { srcURL: params.srcURL }) },
      { id: 'copy-img', label: 'Copy Image',           Icon: Copy,         action: () => mainAction('copyImage', { x: params.webviewX, y: params.webviewY }) },
    ];
    if (params.srcURL) {
      items.push({ id: 'open-img', label: 'Open Image in New Tab', Icon: ExternalLink, action: () => openTab(params.srcURL) });
    }
    sections.push(items);
  }

  // Video section
  if (params.mediaType === 'video') {
    const items: ItemDef[] = [
      { id: 'pip',  label: 'Picture in Picture', Icon: Maximize2, action: () => mainAction('pip') },
      { id: 'loop', label: 'Toggle Loop',         Icon: Repeat,    action: () => mainAction('loop') },
    ];
    if (params.srcURL) {
      items.push({ id: 'copy-vid', label: 'Copy Video URL', Icon: Film, action: () => copyText(params.srcURL) });
    }
    sections.push(items);
  }

  // Page section (always)
  sections.push([
    { id: 'back',    label: 'Back',        Icon: ArrowLeft,  action: () => mainAction('back') },
    { id: 'forward', label: 'Forward',     Icon: ArrowRight, action: () => mainAction('forward') },
    { id: 'reload',  label: 'Reload',      Icon: RefreshCw,  action: () => mainAction('reload') },
    { id: 'devtools',label: 'Inspect',     Icon: Code2,      action: () => mainAction('devtools') },
    { id: 'source',  label: 'View Source', Icon: Eye,        action: () => mainAction('viewSource') },
    { id: 'shot',    label: 'Screenshot',  Icon: Camera,     action: () => { onScreenshot(); onClose(); } },
  ]);

  // Flatten with null separators
  const rows: Row[] = [];
  sections.forEach((sec, i) => {
    if (i > 0) rows.push(null);
    sec.forEach(item => rows.push(item));
  });

  const interactable = rows.filter((r): r is ItemDef => r !== null);

  // ── Submenu hover logic ──────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (openTimer.current)  { clearTimeout(openTimer.current);  openTimer.current  = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const handleItemHover = useCallback((id: string, hasSubmenu: boolean) => {
    const idx = interactable.findIndex(i => i.id === id);
    setActiveIdx(idx);
    clearTimers();
    if (hasSubmenu) {
      openTimer.current = setTimeout(() => setOpenSubmenu(id), 300);
    } else {
      closeTimer.current = setTimeout(() => setOpenSubmenu(null), 150);
    }
  }, [interactable, clearTimers]);

  const handleItemLeave = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpenSubmenu(null), 200);
  }, [clearTimers]);

  const handleSubmenuEnter = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  const handleSubmenuLeave = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpenSubmenu(null), 200);
  }, [clearTimers]);

  // ── Position (measure after mount, then reveal) ──────────────────────────────
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = params.x;
    let y = params.y;
    if (x + width  > vw - 8) x = Math.max(8, vw - width  - 8);
    if (y + height > vh - 8) y = Math.max(8, y - height);
    setPos({ x, y });
    setVisible(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard navigation ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')    { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(p => Math.min(interactable.length - 1, p + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(p => Math.max(0, p - 1));
        return;
      }
      if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        interactable[activeIdx]?.action?.();
        return;
      }
      if (e.key === 'ArrowRight' && activeIdx >= 0) {
        const item = interactable[activeIdx];
        if (item?.submenu?.length) setOpenSubmenu(item.id);
        return;
      }
      if (e.key === 'ArrowLeft') { setOpenSubmenu(null); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIdx, interactable, onClose]);

  // ── Click-outside ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [onClose]);

  // ── Cleanup timers on unmount ────────────────────────────────────────────────
  useEffect(() => () => clearTimers(), [clearTimers]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const menu = (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left:     pos.x,
        top:      pos.y,
        zIndex:   9200,
        minWidth: 208,
        maxWidth: 288,
        visibility: visible ? 'visible' : 'hidden',
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div
        className={[
          'py-1 rounded-xl overflow-hidden',
          'bg-[#141416] border border-white/[0.08]',
          'shadow-[0_12px_40px_rgba(0,0,0,0.75)]',
        ].join(' ')}
        onMouseLeave={handleSubmenuLeave}
        onMouseEnter={handleSubmenuEnter}
      >
        {rows.map((row, i) => {
          if (row === null) {
            return <div key={`sep-${i}`} className="my-1 mx-2 h-px bg-white/[0.06]" />;
          }
          return (
            <MenuItem
              key={row.id}
              item={row}
              isHighlight={interactable.indexOf(row) === activeIdx}
              submenuOpen={openSubmenu === row.id}
              onHover={handleItemHover}
              onLeave={handleItemLeave}
              onCommit={() => { if (!row.disabled) row.action?.(); }}
            />
          );
        })}
      </div>
    </div>
  );

  return createPortal(menu, document.body);
}
