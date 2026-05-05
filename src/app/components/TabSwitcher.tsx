import React, { useEffect, useState } from "react";
import type { Tab } from "../types";

interface TabSwitcherProps {
  tabs:        Tab[];
  activeTabId: string;
  onSelect:    (id: string) => void;
  onClose:     () => void;
  initialDir:  1 | -1;  // +1 = forward (Tab), -1 = backward (Shift+Tab)
}

export function TabSwitcher({ tabs, activeTabId, onSelect, onClose, initialDir }: TabSwitcherProps) {
  const activeIdx = tabs.findIndex(t => t.id === activeTabId);
  const [idx, setIdx] = useState(() => {
    const next = activeIdx + initialDir;
    if (next < 0) return tabs.length - 1;
    if (next >= tabs.length) return 0;
    return next;
  });

  // Ctrl+Tab / Ctrl+Shift+Tab navigation while switcher is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        setIdx(i => {
          const n = e.shiftKey ? i - 1 : i + 1;
          if (n < 0) return tabs.length - 1;
          if (n >= tabs.length) return 0;
          return n;
        });
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tabs.length, onClose]);

  // Release Ctrl → confirm selection
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        const tab = tabs[idx];
        if (tab) onSelect(tab.id);
        onClose();
      }
    };
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, [idx, tabs, onSelect, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto relative
          bg-[#0F0F10]/97 border border-white/[0.1]
          rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.72)]
          overflow-hidden animate-menu-in"
        style={{ minWidth: 340, maxWidth: 480 }}
      >
        <div className="px-4 py-3 border-b border-white/[0.06]
          text-[10px] tracking-[0.24em] uppercase text-white/30">
          Open tabs
        </div>

        <div className="p-1.5 max-h-[420px] overflow-y-auto">
          {tabs.map((tab, i) => {
            const isSelected = i === idx;
            return (
              <button
                key={tab.id}
                onMouseEnter={() => setIdx(i)}
                onClick={() => { onSelect(tab.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                  transition-colors duration-75
                  ${isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}
              >
                {/* Favicon / dot */}
                {tab.favicon ? (
                  <img
                    src={tab.favicon}
                    alt=""
                    width={14}
                    height={14}
                    className="w-3.5 h-3.5 object-contain rounded-sm shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className={`w-[5px] h-[5px] rounded-full shrink-0
                    ${isSelected ? 'bg-white/70' : 'bg-white/25'}`}
                  />
                )}

                {/* Title */}
                <span className={`text-[12.5px] truncate flex-1
                  ${isSelected ? 'text-white/92' : 'text-white/52'}`}>
                  {tab.title || tab.url}
                </span>

                {/* Current marker */}
                {tab.id === activeTabId && (
                  <span className="text-[10px] text-white/25 shrink-0">current</span>
                )}

                {/* Index badge */}
                {i < 9 && (
                  <kbd className="text-[9px] text-white/20 shrink-0 tabular-nums
                    px-1.5 py-[1px] rounded border border-white/[0.07]">
                    {i + 1}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2.5 border-t border-white/[0.06]
          text-[10px] text-white/22 flex gap-3">
          <span><kbd className="font-mono">⌃Tab</kbd> cycle</span>
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span>release <kbd className="font-mono">⌃</kbd> to select</span>
        </div>
      </div>
    </div>
  );
}
