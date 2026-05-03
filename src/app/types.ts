export type Tab = {
  id: string;
  title: string;
  favicon?: string;
  url: string;
  isLoading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  isCrashed?: boolean;
  isPinned?: boolean;
  profileId?: string; // which profile this tab's webview session belongs to
  isAudible?: boolean; // media is currently playing in this tab
  isMuted?: boolean;   // user has muted this tab
};

export type Site = {
  id: string;
  name: string;
  url: string;   // domain only: "github.com"
  color: string;
};

export type HistoryEntry = {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  visitedAt: number;
};

export type Bookmark = {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  addedAt: number;
};

export type DownloadItem = {
  id: string;
  filename: string;
  url: string;
  size?: number;
  receivedBytes?: number; // bytes received so far (for in-progress downloads)
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  savedAt: number;
};

export type StickyAppId = 'telegram' | 'discord' | 'gmail';

export interface StickyAppDef {
  id: string;   // built-ins use StickyAppId; custom apps use 'custom_<timestamp>'
  name: string;
  url: string;
  color: string;
  initial: string;
}
