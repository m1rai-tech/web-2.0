import type { HistoryEntry } from "../types";
import { loadStorage, saveStorage } from "./storage";

const KEY = 'w2_history';
const MAX = 2000;

export function getHistory(): HistoryEntry[] {
  const raw = loadStorage<unknown>(KEY, []);
  return Array.isArray(raw) ? (raw as HistoryEntry[]) : [];
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id'>): HistoryEntry {
  const newEntry: HistoryEntry = { ...entry, id: String(Date.now()) };
  const current = getHistory();
  // Avoid duplicate consecutive entries for same URL
  const recent = current[0];
  if (recent?.url === newEntry.url) return recent;
  const updated = [newEntry, ...current].slice(0, MAX);
  saveStorage(KEY, updated);
  return newEntry;
}

export function clearHistory(): void {
  saveStorage(KEY, []);
}
