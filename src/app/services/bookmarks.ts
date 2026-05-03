import type { Bookmark } from "../types";
import { loadStorage, saveStorage } from "./storage";

const KEY = 'w2_bookmarks';

export function getBookmarks(): Bookmark[] {
  const raw = loadStorage<unknown>(KEY, []);
  return Array.isArray(raw) ? (raw as Bookmark[]) : [];
}

export function addBookmark(entry: Omit<Bookmark, 'id' | 'addedAt'>): Bookmark {
  const existing = getBookmarks();
  const dupe = existing.find(b => b.url === entry.url);
  if (dupe) return dupe;
  const bookmark: Bookmark = { ...entry, id: String(Date.now()), addedAt: Date.now() };
  saveStorage(KEY, [bookmark, ...existing]);
  return bookmark;
}

export function removeBookmark(id: string): void {
  const updated = getBookmarks().filter(b => b.id !== id);
  saveStorage(KEY, updated);
}

export function clearBookmarks(): void {
  saveStorage(KEY, []);
}

export function isBookmarked(url: string): boolean {
  return getBookmarks().some(b => b.url === url);
}
