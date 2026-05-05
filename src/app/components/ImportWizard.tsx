import { useState } from 'react';
import { createPortal } from 'react-dom';
import { addBookmark } from '../services/bookmarks';
import { addHistoryEntry } from '../services/history';

interface Props {
  onDone:    (result: { bookmarks: number; history: number; passwords: number }) => void;
  onDismiss: () => void;
}

const SOURCES = [
  { id: 'edge',    label: 'Microsoft Edge',   color: '#0078D4' },
  { id: 'chrome',  label: 'Google Chrome',    color: '#4285F4' },
  { id: 'firefox', label: 'Mozilla Firefox',  color: '#FF7139' },
] as const;

type SourceId = typeof SOURCES[number]['id'];

export function ImportWizard({ onDone, onDismiss }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSource = async (sourceId: SourceId) => {
    const api = (window as any).electronAPI;
    if (!api?.importBrowserData) {
      onDone({ bookmarks: 0, history: 0, passwords: 0 });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const raw = await api.importBrowserData({ browser: sourceId });
      const data = raw ?? { bookmarks: [], history: [], passwords: [] };

      let bmCount = 0, histCount = 0, pwCount = 0;

      if (Array.isArray(data.bookmarks)) {
        for (const b of data.bookmarks) {
          if (b.url?.startsWith('http')) {
            addBookmark({ url: b.url, title: b.title || b.url, favicon: b.favicon });
            bmCount++;
          }
        }
      }

      if (Array.isArray(data.history)) {
        for (const h of data.history) {
          if (h.url?.startsWith('http')) {
            addHistoryEntry({ url: h.url, title: h.title || h.url, favicon: undefined, visitedAt: Date.now() });
            histCount++;
          }
        }
      }

      if (Array.isArray(data.passwords)) {
        try {
          const existing = JSON.parse(localStorage.getItem('w2_passwords') || '[]');
          localStorage.setItem('w2_passwords', JSON.stringify([...existing, ...data.passwords]));
          pwCount = data.passwords.length;
        } catch {}
      }

      onDone({ bookmarks: bmCount, history: histCount, passwords: pwCount });
    } catch (err) {
      console.error('[ImportWizard] import failed:', err);
      setError('Не вдалося імпортувати. Переконайтесь що браузер закритий і спробуйте ще раз.');
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center
      bg-black/65 backdrop-blur-sm">
      <div className="bg-[#111113] border border-white/[0.1] rounded-2xl
        shadow-[0_32px_80px_rgba(0,0,0,0.8)] w-[460px] p-8">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-[22px] font-semibold text-white/90 mb-2">
            Import from another browser
          </div>
          <div className="text-[13px] text-white/45 leading-relaxed">
            Bookmarks, history and passwords will be imported automatically.
          </div>
        </div>

        {/* Source cards */}
        {!loading && !error && (
          <div className="flex flex-col gap-2.5 mb-6">
            {SOURCES.map(src => (
              <button
                key={src.id}
                onClick={() => handleSource(src.id)}
                className="flex items-center gap-4 px-5 py-4 rounded-xl
                  border border-white/[0.08] bg-white/[0.03]
                  hover:bg-white/[0.07] hover:border-white/[0.16]
                  active:scale-[0.99] transition-all duration-150
                  text-left cursor-pointer group"
              >
                <div
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center
                    text-[15px] font-bold"
                  style={{ background: src.color + '28', color: src.color }}
                >
                  {src.label[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-white/85 font-medium
                    group-hover:text-white transition-colors">
                    {src.label}
                  </div>
                  <div className="text-[11.5px] text-white/35 mt-0.5">
                    Bookmarks · History · Passwords
                  </div>
                </div>
                <div className="text-white/20 group-hover:text-white/50
                  text-[18px] transition-colors shrink-0">
                  →
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 mb-6">
            <div className="w-7 h-7 rounded-full border-2 border-white/20
              border-t-white/70 animate-spin" />
            <div className="text-[13px] text-white/50">Importing data…</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10
            border border-red-500/20 text-[13px] text-red-400/80 text-center">
            {error}
            <button
              onClick={() => setError(null)}
              className="block mx-auto mt-2 text-white/40
                hover:text-white/70 underline text-[12px] cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {/* Dismiss */}
        <div className="text-center">
          <button
            onClick={onDismiss}
            className="text-[12px] text-white/30 hover:text-white/55
              transition-colors underline underline-offset-2 cursor-pointer"
          >
            Don't import, don't show again
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
