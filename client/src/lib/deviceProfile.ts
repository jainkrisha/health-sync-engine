/**
 * deviceProfile.ts — lets one browser act as several "devices" for demos.
 *
 * Open the app with ?device=B and that tab gets its own IndexedDB database,
 * its own clientId and its own login, exactly like a second tablet would. The
 * choice sticks for the tab (sessionStorage) so in-app navigation keeps it.
 */

const SESSION_KEY = 'healthsync.deviceProfile';

function readProfile(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('device');
    if (fromUrl !== null) {
      const clean = fromUrl.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
      const value = clean || 'default';
      sessionStorage.setItem(SESSION_KEY, value);
      return value;
    }
    return sessionStorage.getItem(SESSION_KEY) || 'default';
  } catch {
    return 'default';
  }
}

export const deviceProfile = readProfile();

/** Namespaces a storage key by profile, e.g. "healthsync.B.auth". */
export function profileKey(name: string): string {
  return deviceProfile === 'default' ? `healthsync.${name}` : `healthsync.${deviceProfile}.${name}`;
}

export const databaseName = deviceProfile === 'default' ? 'HealthSync' : `HealthSync-${deviceProfile}`;

function browserName(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Browser';
}

export const deviceLabel = deviceProfile === 'default' ? `This device (${browserName()})` : `Device ${deviceProfile} (${browserName()})`;

/** Stable per-device id used in every vector clock this device writes. */
export function getClientId(): string {
  const key = profileKey('clientId');
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'ephemeral-' + crypto.randomUUID();
  }
}
