import React, { useState, useRef, useEffect } from "react";
import { X, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, Globe } from "lucide-react";
import type { Site } from "../types";

const ACCENT_PALETTE = [
  "#FF3B3B", "#A259FF", "#5B8DEF", "#10A37F", "#FF9F0A",
  "#30D158", "#64D2FF", "#FF6B6B", "#C084FC", "#34D399",
];

interface SiteManagerProps {
  open: boolean;
  sites: Site[];
  onClose: () => void;
  onSitesChange: (sites: Site[]) => void;
}

export function SiteManager({ open, sites, onClose, onSitesChange }: SiteManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addMode, setAddMode]     = useState(false);
  const [newName, setNewName]     = useState("");
  const [newUrl,  setNewUrl]      = useState("");
  const [newErr,  setNewErr]      = useState("");

  // reset form when panel closes
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setAddMode(false);
      setNewName(""); setNewUrl(""); setNewErr("");
    }
  }, [open]);

  // reorder
  const move = (id: string, dir: -1 | 1) => {
    const idx = sites.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const next = [...sites];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onSitesChange(next);
  };

  // remove
  const remove = (id: string) => {
    onSitesChange(sites.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  // update existing site
  const update = (id: string, name: string, url: string) => {
    const domain = url.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
    onSitesChange(sites.map((s) => s.id === id ? { ...s, name: name.trim(), url: domain } : s));
    setEditingId(null);
  };

  // add new site
  const addSite = () => {
    if (!newName.trim()) { setNewErr("Name is required."); return; }
    if (!newUrl.trim())  { setNewErr("URL is required.");  return; }
    const domain = newUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
    const color  = ACCENT_PALETTE[sites.length % ACCENT_PALETTE.length];
    onSitesChange([...sites, { id: String(Date.now()), name: newName.trim(), url: domain, color }]);
    setNewName(""); setNewUrl(""); setNewErr("");
    setAddMode(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 z-[48] transition-opacity duration-300 bg-black/30 backdrop-blur-[1px]
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`absolute inset-y-0 right-0 z-[49] w-[356px] flex flex-col
          bg-[#0E0E0F]/98 border-l border-white/[0.07]
          shadow-[-32px_0_80px_rgba(0,0,0,0.55)]
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div>
            <div className="text-[13.5px] text-white/90">Site Manager</div>
            <div className="text-[11px] text-white/35 mt-0.5">
              {sites.length} {sites.length === 1 ? "site" : "sites"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/40
              hover:text-white hover:bg-white/[0.07] transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Site list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sites.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-2 px-6 text-center animate-fade-up">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/20">
                <Globe size={18} strokeWidth={1.5} />
              </div>
              <p className="text-[13px] text-white/50">No sites yet</p>
              <p className="text-[11px] text-white/28 leading-relaxed">
                Add your first favorite site using the button below.
              </p>
            </div>
          )}

          {sites.map((site, i) => (
            <SiteRow
              key={site.id}
              site={site}
              isFirst={i === 0}
              isLast={i === sites.length - 1}
              isEditing={editingId === site.id}
              onEdit={() => setEditingId(editingId === site.id ? null : site.id)}
              onSave={(name, url) => update(site.id, name, url)}
              onCancel={() => setEditingId(null)}
              onRemove={() => remove(site.id)}
              onMoveUp={() => move(site.id, -1)}
              onMoveDown={() => move(site.id, 1)}
            />
          ))}
        </div>

        {/* Add site form */}
        <div className="border-t border-white/[0.06] px-4 py-3 shrink-0">
          {addMode ? (
            <div className="space-y-2 animate-fade-up">
              <div className="text-[11px] text-white/45 mb-2">Add new site</div>
              <Field
                label="Name"
                value={newName}
                onChange={setNewName}
                placeholder="e.g. Vercel"
                autoFocus
              />
              <UrlField
                value={newUrl}
                onChange={(v) => { setNewUrl(v); setNewErr(""); }}
                placeholder="vercel.com"
              />
              {newErr && <p className="text-[11px] text-red-400/90">{newErr}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setAddMode(false); setNewName(""); setNewUrl(""); setNewErr(""); }}
                  className="flex-1 h-8 rounded-lg text-[12px] text-white/50 hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addSite}
                  className="flex-1 h-8 rounded-lg text-[12px] bg-white/[0.09] hover:bg-white/[0.14] text-white/90 transition-colors border border-white/[0.1]"
                >
                  Add site
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddMode(true)}
              className="w-full h-9 rounded-lg border border-dashed border-white/[0.1]
                hover:border-white/[0.2] hover:bg-white/[0.03]
                flex items-center justify-center gap-2
                text-[12px] text-white/40 hover:text-white/70
                transition-all duration-150"
            >
              <Plus size={13} strokeWidth={1.75} />
              Add site
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Site row ──────────────────────────────────────────────────────────────────

function SiteRow({
  site, isFirst, isLast, isEditing,
  onEdit, onSave, onCancel, onRemove, onMoveUp, onMoveDown,
}: {
  site: Site;
  isFirst: boolean;
  isLast: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (name: string, url: string) => void;
  onCancel: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editName, setEditName] = useState(site.name);
  const [editUrl,  setEditUrl]  = useState(site.url);
  const faviconSrc = `https://www.google.com/s2/favicons?domain=${site.url}&sz=32`;
  const [faviconOk, setFaviconOk] = useState(true);

  useEffect(() => {
    if (isEditing) { setEditName(site.name); setEditUrl(site.url); }
  }, [isEditing, site.name, site.url]);

  const saveEdit = () => {
    if (!editName.trim() || !editUrl.trim()) return;
    onSave(editName, editUrl);
  };

  return (
    <div className="group px-3 py-2">
      {/* Main row */}
      <div className="flex items-center gap-2">

        {/* Reorder */}
        <div className="flex flex-col gap-[1px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-4 h-4 rounded flex items-center justify-center text-white/35 hover:text-white hover:bg-white/[0.07] disabled:opacity-20 disabled:pointer-events-none transition-colors"
          >
            <ChevronUp size={10} strokeWidth={2.5} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="w-4 h-4 rounded flex items-center justify-center text-white/35 hover:text-white hover:bg-white/[0.07] disabled:opacity-20 disabled:pointer-events-none transition-colors"
          >
            <ChevronDown size={10} strokeWidth={2.5} />
          </button>
        </div>

        {/* Favicon */}
        <div
          className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${site.color}22, ${site.color}0a)` }}
        >
          {faviconOk ? (
            <img
              src={faviconSrc}
              alt={site.name}
              width={18}
              height={18}
              className="w-[18px] h-[18px] object-contain"
              onError={() => setFaviconOk(false)}
            />
          ) : (
            <span className="text-[13px] select-none" style={{ color: site.color }}>
              {site.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] text-white/85 leading-tight truncate">{site.name}</div>
          <div className="text-[10.5px] text-white/35 truncate mt-0.5">{site.url}</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              isEditing
                ? "bg-white/[0.09] text-white"
                : "text-white/35 hover:text-white hover:bg-white/[0.07]"
            }`}
          >
            <Pencil size={11} strokeWidth={2} />
          </button>
          <button
            onClick={onRemove}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/30 hover:text-red-400/80 hover:bg-red-400/[0.08] transition-colors"
          >
            <Trash2 size={11} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Inline edit form */}
      {isEditing && (
        <div className="mt-2.5 ml-[36px] space-y-1.5 animate-fade-up">
          <Field
            label="Name"
            value={editName}
            onChange={setEditName}
            placeholder="Site name"
            autoFocus
          />
          <UrlField
            value={editUrl}
            onChange={setEditUrl}
            placeholder="domain.com"
          />
          <div className="flex gap-1.5 pt-0.5">
            <button
              onClick={onCancel}
              className="flex-1 h-7 rounded-md text-[11px] text-white/45 hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className="flex-1 h-7 rounded-md text-[11px] bg-white/[0.08] hover:bg-white/[0.13] text-white/85 transition-colors border border-white/[0.08] flex items-center justify-center gap-1"
            >
              <Check size={10} strokeWidth={2.5} /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared field components ───────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  return (
    <div>
      <span className="text-[10px] tracking-wider uppercase text-white/35">{label}</span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full h-8 rounded-lg bg-white/[0.04] border border-white/[0.09]
          focus:border-white/[0.22] px-3 text-[12.5px] text-white placeholder:text-white/25
          outline-none transition-colors"
      />
    </div>
  );
}

function UrlField({
  value, onChange, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <span className="text-[10px] tracking-wider uppercase text-white/35">URL</span>
      <div className="mt-1 flex h-8 rounded-lg bg-white/[0.04] border border-white/[0.09] focus-within:border-white/[0.22] overflow-hidden transition-colors">
        <span className="flex items-center pl-2.5 pr-1 text-[11px] text-white/28 shrink-0 select-none">
          https://
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent pr-3 text-[12.5px] text-white placeholder:text-white/25 outline-none"
        />
      </div>
    </div>
  );
}
