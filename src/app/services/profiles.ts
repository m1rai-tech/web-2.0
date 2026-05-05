export interface Profile {
  id: string;
  name: string;
  color: string;
  partition: string; // '' = default session; 'persist:...' for isolated profiles
}

export const BUILT_IN_PROFILES: Profile[] = [
  { id: 'default',  name: 'Default',  color: '#A0A0A0', partition: '' },
  { id: 'work',     name: 'Work',     color: '#5B8DEF', partition: 'persist:profile-work' },
  { id: 'personal', name: 'Personal', color: '#10A37F', partition: 'persist:profile-personal' },
];

const KEY        = 'w2_profiles_v1';
const KEY_ACTIVE = 'w2_active_profile_v1';

export function getProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Profile[];
  } catch {}
  return [...BUILT_IN_PROFILES];
}

export function saveProfiles(p: Profile[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

export function getActiveProfileId(): string {
  try { return localStorage.getItem(KEY_ACTIVE) || 'default'; } catch { return 'default'; }
}

export function saveActiveProfileId(id: string): void {
  try { localStorage.setItem(KEY_ACTIVE, id); } catch {}
}

export function createProfile(name: string, color: string): Profile {
  const id = `profile_${Date.now()}`;
  return { id, name, color, partition: `persist:${id}` };
}

export const PROFILE_COLORS = [
  '#A0A0A0', '#5B8DEF', '#10A37F', '#FF3B3B',
  '#A259FF', '#FF9F0A', '#30D158', '#FF6B6B',
  '#64D2FF', '#C084FC', '#F472B6', '#34D399',
];
