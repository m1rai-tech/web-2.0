export type PinnableId =
  | 'downloads'
  | 'extensions'
  | 'history'
  | 'bookmarks'
  | 'screenshot'
  | 'find'
  | 'print';

export const DEFAULT_PINNED: PinnableId[] = [
  'downloads', 'extensions', 'history', 'bookmarks', 'screenshot',
];

const KEY = 'w2_pinned_toolbar_v1';

export function getPinnedActions(): PinnableId[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as PinnableId[];
  } catch {}
  return [...DEFAULT_PINNED];
}

export function savePinnedActions(ids: PinnableId[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
}
