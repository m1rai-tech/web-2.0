import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus } from "lucide-react";
import { Tip } from "./Tip";
import type { StickyAppDef } from "../types";

// ── Sidebar icon strip ────────────────────────────────────────────────────────

interface StickyAppsBarProps {
  apps:        StickyAppDef[];
  activeAppId: string | null;
  onToggle:    (id: string) => void;
  onAddApp:    (name: string, url: string) => void;
  onRemoveApp: (id: string) => void;
}

export function StickyAppsBar({
  apps, activeAppId, onToggle, onAddApp, onRemoveApp,
}: StickyAppsBarProps) {
  const [addOpen,   setAddOpen]   = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div
      className="w-12 shrink-0 flex flex-col items-center gap-1 py-2.5
        border-r border-white/[0.06] bg-black/25"
    >
      {apps.map(app => {
        const isActive = activeAppId === app.id;
        const isCustom = app.id.startsWith('custom_');

        return (
          <div
            key={app.id}
            className="relative"
            onMouseEnter={() => setHoveredId(app.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <Tip label={app.name} delay={400}>
              <button
                onClick={() => onToggle(app.id)}
                aria-label={app.name}
                className={`w-9 h-9 rounded-xl flex items-center justify-center
                  text-[13px] font-bold tracking-tight select-none shrink-0
                  overflow-hidden transition-all duration-150
                  ${isActive
                    ? 'border border-white/[0.14] bg-white/[0.09]'
                    : 'border border-transparent text-white/40 hover:text-white/75 hover:bg-white/[0.05]'
                  }`}
                style={isActive ? { color: app.color } : undefined}
              >
                <AppIcon app={app} isActive={isActive} />
              </button>
            </Tip>

            {/* Remove button — only custom apps, on hover */}
            {isCustom && hoveredId === app.id && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveApp(app.id); }}
                className="absolute -top-[5px] -right-[5px] w-[15px] h-[15px] rounded-full z-10
                  bg-[#1A1A1C] border border-white/[0.18]
                  flex items-center justify-center
                  text-white/50 hover:text-red-400 hover:border-red-400/30
                  transition-colors cursor-pointer"
              >
                <X size={7} strokeWidth={2.5} />
              </button>
            )}
          </div>
        );
      })}

      {/* Add custom app */}
      <Tip label="Add sidebar app" delay={400}>
        <button
          onClick={() => setAddOpen(true)}
          className="mt-1 w-9 h-9 rounded-xl flex items-center justify-center
            border border-dashed border-white/[0.12] text-white/22
            hover:text-white/60 hover:border-white/[0.28] hover:bg-white/[0.03]
            transition-all duration-150 cursor-pointer"
        >
          <Plus size={13} strokeWidth={1.75} />
        </button>
      </Tip>

      {/* Add app modal */}
      {addOpen && createPortal(
        <AddAppModal
          onClose={() => setAddOpen(false)}
          onAdd={(name, url) => { onAddApp(name, url); setAddOpen(false); }}
        />,
        document.body,
      )}
    </div>
  );
}

// ── App icon ──────────────────────────────────────────────────────────────────

function AppIcon({ app, isActive }: { app: StickyAppDef; isActive: boolean }) {
  const [failed, setFailed] = useState(false);
  const domain = app.url.replace(/^https?:\/\//, '').split('/')[0];

  if (failed) {
    return (
      <span style={{ color: isActive ? app.color : undefined }}>
        {app.initial}
      </span>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt={app.initial}
      width={16}
      height={16}
      className="w-4 h-4 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

// ── Add app modal ─────────────────────────────────────────────────────────────

function AddAppModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd:   (name: string, url: string) => void;
}) {
  const [name, setName] = useState('');
  const [url,  setUrl]  = useState('');
  const [err,  setErr]  = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 60); }, []);

  const submit = () => {
    if (!name.trim()) { setErr('Name is required.'); return; }
    if (!url.trim())  { setErr('URL is required.');  return; }
    onAdd(name.trim(), url.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[9100] flex items-center justify-center"
      onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-[380px] rounded-2xl border border-white/10 bg-[#111]/96
          backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden animate-menu-in"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <span className="text-[13.5px] text-white/88">Add sidebar app</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-white/[0.07] text-white/40
              flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-[10.5px] tracking-wider uppercase text-white/36">Name</span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Notion"
              className="mt-1.5 w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.09]
                focus:border-white/[0.24] px-3 text-[13px] text-white placeholder:text-white/26
                outline-none transition-colors"
            />
          </label>

          <label className="block">
            <span className="text-[10.5px] tracking-wider uppercase text-white/36">URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://notion.so"
              className="mt-1.5 w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.09]
                focus:border-white/[0.24] px-3 text-[13px] text-white placeholder:text-white/26
                outline-none transition-colors"
            />
          </label>

          {err && <p className="text-[11.5px] text-red-400/90">{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="h-8 px-4 rounded-lg text-[12px] text-white/55
                hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              className="h-8 px-4 rounded-lg text-[12px] bg-white text-black
                hover:bg-white/90 transition-colors cursor-pointer"
            >
              Add app
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Persistent webview panel ──────────────────────────────────────────────────

interface StickyAppsLayerProps {
  apps:        StickyAppDef[];
  activeAppId: string | null;
  onClose:     () => void;
}

export function StickyAppsLayer({ apps, activeAppId, onClose }: StickyAppsLayerProps) {
  const webviewRefs = useRef<Record<string, HTMLElement>>({});
  const isOpen    = !!activeAppId;
  const activeApp = apps.find(a => a.id === activeAppId);

  return (
    <>
      {/* Click-outside backdrop */}
      {isOpen && (
        <div className="absolute inset-0 z-40" onClick={onClose} />
      )}

      {/* Slide-out panel */}
      <div
        className="absolute top-0 bottom-0 left-0 z-50 flex flex-col
          border-r border-white/[0.09] bg-[#0B0B0C]
          shadow-[6px_0_32px_rgba(0,0,0,0.55)]"
        style={{
          width: 390,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3.5 py-2.5 shrink-0
            border-b border-white/[0.06]"
          style={{ borderTop: `2px solid ${activeApp?.color ?? 'transparent'}` }}
        >
          <div className="flex items-center gap-2">
            {activeApp && (
              <span className="text-[13px] font-bold" style={{ color: activeApp.color }}>
                {activeApp.initial}
              </span>
            )}
            <span className="text-[12px] text-white/60">{activeApp?.name ?? ''}</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center
              text-white/30 hover:text-white/70 hover:bg-white/[0.06]
              transition-colors cursor-pointer"
          >
            <X size={11} strokeWidth={2} />
          </button>
        </div>

        {/* Webviews — all mounted, only active is visible */}
        <div className="flex-1 relative overflow-hidden">
          {apps.map(app => (
            <webview
              key={app.id}
              src={app.url}
              allowpopups=""
              ref={(el: HTMLElement | null) => {
                if (el) webviewRefs.current[app.id] = el;
                else    delete webviewRefs.current[app.id];
              }}
              style={{
                position: 'absolute', inset: 0,
                visibility: activeAppId === app.id ? 'visible' : 'hidden',
                pointerEvents: activeAppId === app.id ? 'auto' : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
