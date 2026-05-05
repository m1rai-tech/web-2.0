import { useState, useRef, type ReactNode } from "react";

/**
 * Lightweight custom tooltip — appears below the wrapped element after a 550ms delay.
 * Stays invisible to pointer events so it never blocks interaction.
 */
export function Tip({
  label,
  children,
  delay = 550,
}: {
  label: string;
  children: ReactNode;
  delay?: number;
}) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const enter = () => {
    timer.current = setTimeout(() => setShow(true), delay);
  };
  const leave = () => {
    clearTimeout(timer.current);
    setShow(false);
  };

  return (
    <span className="relative inline-flex" onMouseEnter={enter} onMouseLeave={leave}>
      {children}
      {show && (
        <span
          className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[70]
            px-2 py-[5px] rounded-lg
            bg-[#1A1A1A]/98 border border-white/[0.1]
            text-[10.5px] text-white/72 whitespace-nowrap
            shadow-[0_8px_20px_rgba(0,0,0,0.55)]
            backdrop-blur-xl"
        >
          {label}
          {/* caret */}
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-b-[#1A1A1A]" />
        </span>
      )}
    </span>
  );
}
