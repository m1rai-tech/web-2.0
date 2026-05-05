import { useEffect, useState } from "react";

export function TimeWidget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  return (
    <div className="inline-flex flex-col items-center px-6 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl">
      <span className="tabular-nums tracking-tight text-white text-[28px] leading-none">{time}</span>
      <span className="mt-1.5 text-[11px] text-white/45 tracking-wide">{date}</span>
    </div>
  );
}
