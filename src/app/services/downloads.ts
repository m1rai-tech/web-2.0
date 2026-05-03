import type { DownloadItem } from "../types";
import { loadStorage, saveStorage } from "./storage";

const KEY = 'w2_downloads';

export function getDownloads(): DownloadItem[] {
  const raw = loadStorage<unknown>(KEY, []);
  const all = Array.isArray(raw) ? (raw as DownloadItem[]) : [];
  // Drop orphaned in-progress items from previous sessions
  return all.filter(d => d.state !== 'progressing');
}

export function saveDownload(item: DownloadItem): void {
  const current = getDownloads().filter(d => d.id !== item.id);
  saveStorage(KEY, [item, ...current].slice(0, 200));
}

export function clearDownloads(): void {
  saveStorage(KEY, []);
}
