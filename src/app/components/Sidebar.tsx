import { Home, Bookmark, History, Download, Settings, Focus } from "lucide-react";
import { useState } from "react";
import { LogoBadge } from "./Logo";

const items = [
  { id: "home", label: "Home", Icon: Home },
  { id: "bookmarks", label: "Bookmarks", Icon: Bookmark },
  { id: "history", label: "History", Icon: History },
  { id: "downloads", label: "Downloads", Icon: Download },
  { id: "settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  const [active, setActive] = useState("home");
  return (
    <aside className="w-[68px] shrink-0 h-full flex flex-col items-center py-4 border-r border-white/[0.06] bg-black/40 backdrop-blur-xl">
      <LogoBadge size={44} />
      <div className="mt-6 flex flex-col gap-1 w-full items-center">
        {items.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all group ${
                isActive
                  ? "bg-white/[0.08] border border-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span className="text-[9px] tracking-wide opacity-80">{label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto">
        <button className="w-11 h-11 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/60 hover:text-white flex items-center justify-center transition-colors" title="Focus">
          <Focus size={15} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}