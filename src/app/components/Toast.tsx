import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";

interface ToastProps {
  message:   string;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, onDismiss, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  return createPortal(
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9500] animate-fade-up
        flex items-center gap-3 pl-3.5 pr-2 py-2.5 rounded-xl
        bg-[#1A1A1C]/97 border border-white/[0.11] backdrop-blur-2xl
        shadow-[0_16px_48px_rgba(0,0,0,0.6)] max-w-[400px] min-w-[240px]"
    >
      <CheckCircle2 size={14} className="text-green-400/80 shrink-0" strokeWidth={1.75} />
      <span className="text-[12px] text-white/72 truncate flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="w-5 h-5 rounded flex items-center justify-center
          text-white/22 hover:text-white/55 transition-colors shrink-0"
      >
        <X size={10} strokeWidth={2} />
      </button>
    </div>,
    document.body,
  );
}
