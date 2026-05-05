import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";

interface FindBarProps {
  onFind:        (text: string, forward?: boolean) => void;
  onClose:       () => void;
  matchCount?:   number;
  activeMatch?:  number;
}

export function FindBar({ onFind, onClose, matchCount, activeMatch }: FindBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    onFind(val, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onFind(text, !e.shiftKey);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const matchLabel =
    matchCount === undefined ? '' :
    matchCount === 0         ? 'No results' :
    `${activeMatch ?? 1} / ${matchCount}`;

  return (
    <div
      className="absolute bottom-0 right-4 z-50 flex items-center gap-1.5 px-3 py-2
        rounded-t-xl bg-[#0F0F10]/97 border border-b-0 border-white/[0.1]
        shadow-[0_-8px_32px_rgba(0,0,0,0.45)] animate-menu-in"
    >
      <Search size={12} className="text-white/38 shrink-0" strokeWidth={1.75} />

      <input
        ref={inputRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Find in page…"
        className="w-44 bg-transparent text-[12.5px] text-white outline-none
          placeholder:text-white/26"
      />

      {text && (
        <span className="text-[11px] text-white/36 tabular-nums min-w-[4.5ch] text-center">
          {matchLabel}
        </span>
      )}

      <div className="flex items-center gap-0.5 ml-0.5">
        <button
          onClick={() => onFind(text, false)}
          disabled={!text}
          aria-label="Previous result"
          className="w-6 h-6 rounded flex items-center justify-center
            text-white/40 hover:text-white/80 hover:bg-white/[0.06]
            disabled:opacity-25 transition-colors"
        >
          <ChevronUp size={12} strokeWidth={2} />
        </button>
        <button
          onClick={() => onFind(text, true)}
          disabled={!text}
          aria-label="Next result"
          className="w-6 h-6 rounded flex items-center justify-center
            text-white/40 hover:text-white/80 hover:bg-white/[0.06]
            disabled:opacity-25 transition-colors"
        >
          <ChevronDown size={12} strokeWidth={2} />
        </button>
      </div>

      <button
        onClick={onClose}
        aria-label="Close find bar"
        className="w-6 h-6 rounded flex items-center justify-center ml-0.5
          text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
      >
        <X size={11} strokeWidth={2} />
      </button>
    </div>
  );
}
