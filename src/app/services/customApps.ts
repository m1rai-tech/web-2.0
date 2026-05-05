import type { StickyAppDef } from '../types';

const KEY = 'w2_custom_apps_v1';

const COLORS = [
  '#FF3B3B','#A259FF','#5B8DEF','#10A37F','#FF9F0A',
  '#30D158','#64D2FF','#FF6B6B','#C084FC','#34D399',
];

export function getCustomApps(): StickyAppDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StickyAppDef[]) : [];
  } catch { return []; }
}

export function addCustomApp(name: string, rawUrl: string): StickyAppDef {
  const apps = getCustomApps();
  const url  = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const app: StickyAppDef = {
    id:      `custom_${Date.now()}`,
    name:    name.trim(),
    url,
    color:   COLORS[apps.length % COLORS.length],
    initial: name.trim()[0]?.toUpperCase() ?? '?',
  };
  localStorage.setItem(KEY, JSON.stringify([...apps, app]));
  return app;
}

export function removeCustomApp(id: string): StickyAppDef[] {
  const apps = getCustomApps().filter(a => a.id !== id);
  localStorage.setItem(KEY, JSON.stringify(apps));
  return apps;
}
