import { loadStorage, saveStorage } from './storage';
import type { Tab } from '../types';

const SESSION_KEY = 'w2_session_v2';

export interface SessionSnapshot {
  tabs:         Pick<Tab, 'id' | 'title' | 'favicon' | 'url'>[];
  activeTabId:  string;
  splitPanels:  string[];
  panelSizes:   number[];
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSessionSave(snap: SessionSnapshot): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    saveStorage(SESSION_KEY, snap);
    _debounceTimer = null;
  }, 500);
}

export function flushSessionSave(snap: SessionSnapshot): void {
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
  saveStorage(SESSION_KEY, snap);
}

export function loadSession(): SessionSnapshot | null {
  try {
    const data = loadStorage<SessionSnapshot | null>(SESSION_KEY, null);
    if (!data || !Array.isArray(data.tabs) || data.tabs.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}
