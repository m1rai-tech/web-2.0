const ua = typeof navigator !== 'undefined' ? (navigator.userAgent ?? '') : '';

export const isMac = /Mac|iPhone|iPad/i.test(ua);

/** Returns a keyboard shortcut label, e.g. "⌘T" on Mac or "Ctrl+T" on Windows. */
export function kbd(key: string, shift = false): string {
  if (isMac) return shift ? `⌘⇧${key}` : `⌘${key}`;
  return shift ? `Ctrl+Shift+${key}` : `Ctrl+${key}`;
}
