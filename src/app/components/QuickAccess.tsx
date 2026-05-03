import React, { useState, useEffect } from "react";
import { Plus, Settings, MoreHorizontal, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { Tip } from "./Tip";
import type { Site } from "../types";

interface QuickAccessProps {
  sites: Site[];
  onOpenManager: () => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, name: string, url: string) => void;
  onNavigate: (url: string) => void;
}

export function QuickAccess({ sites, onOpenManager, onRemove, onEdit, onNavigate }: QuickAccessProps) {
  const [openMenu,  setOpenMenu]  = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const close = (e: MouseEvent) => {
      // Don't close when the mousedown is inside the open dropdown.
      if ((e.target as Element).closest('[data-qamenu]')) return;
      setOpenMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenu]);

  return (
    <div className="w-full max-w-[860px] animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-0.5">
        <span className="text-[10px] tracking-[0.28em] text-white/28 uppercase select-none">
          Favorite sites
        </span>
        <Tip label="Manage sites">
          <button
            onClick={onOpenManager}
            className="w-[26px] h-[26px] rounded-lg flex items-center justify-center
              text-white/28 hover:text-white/70
              hover:bg-white/[0.06] transition-all duration-150"
          >
            <Settings size={13} strokeWidth={1.6} />
          </button>
        </Tip>
      </div>

      {/* Grid */}
      {sites.length === 0 ? (
        <div
          className="h-[104px] rounded-xl border border-dashed border-white/[0.07]
            flex flex-col items-center justify-center gap-2 text-white/22 cursor-pointer
            hover:border-white/[0.13] hover:text-white/45 hover:bg-white/[0.015]
            transition-all duration-200"
          onClick={onOpenManager}
        >
          <Plus size={18} strokeWidth={1.5} />
          <span className="text-[12px]">Add your favorite sites</span>
        </div>
      ) : (
        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(sites.length + 1, 6)}, minmax(0,1fr))` }}
        >
          {sites.map((s) => (
            <SiteCard
              key={s.id}
              site={s}
              menuOpen={openMenu === s.id}
              onMenuToggle={(e) => {
                e.stopPropagation();
                setOpenMenu(openMenu === s.id ? null : s.id);
              }}
              onOpen={() => onNavigate(`https://${s.url}`)}
              onEdit={() => { setOpenMenu(null); setEditingId(s.id); }}
              onRemove={() => { setOpenMenu(null); onRemove(s.id); }}
            />
          ))}

          {sites.length < 8 && (
            <button
              onClick={onOpenManager}
              className="h-[104px] rounded-xl border border-dashed border-white/[0.07]
                hover:border-white/[0.15] hover:bg-white/[0.02]
                flex flex-col items-center justify-center gap-1.5
                text-white/22 hover:text-white/50
                transition-all duration-200 group"
            >
              <Plus size={15} strokeWidth={1.5} className="group-hover:scale-110 transition-transform duration-150" />
              <span className="text-[10.5px]">Add site</span>
            </button>
          )}
        </div>
      )}

      {/* Quick-edit modal */}
      {editingId && (
        <QuickEditModal
          site={sites.find((s) => s.id === editingId)!}
          onClose={() => setEditingId(null)}
          onSave={(name, url) => {
            onEdit(editingId, name, url);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

// ── Site card ─────────────────────────────────────────────────────────────────

function SiteCard({ site, menuOpen, onMenuToggle, onOpen, onEdit, onRemove }: {
  site: Site;
  menuOpen: boolean;
  onMenuToggle: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [faviconOk, setFaviconOk] = useState(true);
  const faviconSrc = `https://www.google.com/s2/favicons?domain=${site.url}&sz=64`;

  return (
    <div
      className="group relative h-[104px] rounded-xl cursor-pointer select-none
        border border-white/[0.07] bg-white/[0.024]
        hover:bg-white/[0.055] hover:border-white/[0.13]
        hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]
        active:translate-y-0 active:scale-[0.98]
        transition-all duration-200 ease-out
        p-3.5 flex flex-col justify-between"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center
            border border-white/[0.08] overflow-hidden shrink-0
            transition-transform duration-200 group-hover:scale-[1.06]"
          style={{ background: `linear-gradient(135deg, ${site.color}28, ${site.color}0c)` }}
        >
          {faviconOk ? (
            <img
              src={faviconSrc}
              alt={site.name}
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
              onError={() => setFaviconOk(false)}
            />
          ) : (
            <span className="text-[14px] select-none" style={{ color: site.color }}>
              {site.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <button
          onClick={onMenuToggle}
          className="w-6 h-6 -mt-0.5 -mr-0.5 rounded-md flex items-center justify-center
            text-white/28 hover:text-white/80 hover:bg-white/[0.08]
            opacity-0 group-hover:opacity-100 transition-all duration-150"
        >
          <MoreHorizontal size={12} strokeWidth={2} />
        </button>
      </div>

      <div>
        <div className="text-[12.5px] text-white/85 leading-tight truncate">{site.name}</div>
        <div className="text-[10.5px] text-white/32 mt-0.5 truncate">{site.url}</div>
      </div>

      {menuOpen && (
        <div
          data-qamenu
          className="absolute top-11 right-2 z-20 w-[140px] rounded-xl
            border border-white/[0.1] bg-[#131315]/98 backdrop-blur-2xl
            shadow-[0_12px_40px_rgba(0,0,0,0.65)] py-1 overflow-hidden
            animate-menu-in"
        >
          <MenuRow icon={<ExternalLink size={11} />} label="Open"   onClick={onOpen}   />
          <MenuRow icon={<Pencil      size={11} />} label="Edit"   onClick={onEdit}   />
          <div className="my-1 mx-2 border-t border-white/[0.07]" />
          <MenuRow icon={<Trash2      size={11} />} label="Remove" onClick={onRemove} danger />
        </div>
      )}
    </div>
  );
}

function MenuRow({ icon, label, onClick, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center gap-2.5 px-3 py-[6px]
        text-[12px] transition-colors duration-100 text-left
        ${danger ? "text-red-400/85 hover:bg-red-500/[0.08]" : "text-white/75 hover:bg-white/[0.06]"}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <span className="text-current/60">{icon}</span>
      {label}
    </button>
  );
}

// ── Quick edit modal ──────────────────────────────────────────────────────────

function QuickEditModal({ site, onClose, onSave }: {
  site: Site; onClose: () => void; onSave: (name: string, url: string) => void;
}) {
  const [name, setName] = useState(site.name);
  const [url,  setUrl]  = useState(site.url);
  const nameRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const submit = () => {
    if (!name.trim() || !url.trim()) return;
    onSave(name.trim(), url.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[400px] rounded-2xl border border-white/[0.1] bg-[#111]/96 backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden animate-menu-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <span className="text-[13.5px] text-white/88">Edit site</span>
          <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-white/[0.07] text-white/45 flex items-center justify-center transition-colors">
            <X size={13} strokeWidth={2} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <ModalField label="Name" value={name} onChange={setName} placeholder="e.g. Linear" ref={nameRef} />
          <ModalField label="URL"  value={url}  onChange={setUrl}  placeholder="domain.com" />
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose}  className="h-8 px-4 rounded-lg text-[12px] text-white/55 hover:bg-white/[0.05] transition-colors">Cancel</button>
            <button onClick={submit}   className="h-8 px-4 rounded-lg text-[12px] bg-white text-black hover:bg-white/90 transition-colors">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ModalField = React.forwardRef<
  HTMLInputElement,
  { label: string; value: string; onChange: (v: string) => void; placeholder: string }
>(({ label, value, onChange, placeholder }, ref) => (
  <label className="block">
    <span className="text-[10.5px] tracking-wider uppercase text-white/35">{label}</span>
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
