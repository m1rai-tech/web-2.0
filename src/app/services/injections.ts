export interface Injection {
  id: string;
  name: string;
  urlPattern: string; // supports * wildcards, e.g. https://github.com/*
  css: string;
  js: string;
  enabled: boolean;
}

const KEY = 'w2_injections_v1';

export function getInjections(): Injection[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Injection[];
  } catch {}
  return [];
}

export function saveInjections(list: Injection[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

// Supports * wildcards. Example: "https://github.com/*" matches all GitHub pages.
export function matchesUrl(pattern: string, url: string): boolean {
  if (!pattern || !url) return false;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  try {
    return new RegExp(`^${escaped}$`).test(url);
  } catch {
    return false;
  }
}
