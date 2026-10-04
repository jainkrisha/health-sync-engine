/**
 * encryption.ts — AES-256-GCM encryption for data at rest, using the Web Crypto API.
 *
 * Key choice (documented per the task split): each device generates one random
 * 256-bit key the first time it runs and keeps it in IndexedDB as a
 * NON-EXTRACTABLE CryptoKey. Patient records and queued mutations are stored only
 * as ciphertext, so they are unreadable in DevTools, in a copied profile folder,
 * or in a disk dump. The key never leaves the browser and cannot be exported by
 * page scripts. The trade-off versus a passphrase-derived key is that anyone who
 * can run code inside this browser profile while logged in can still decrypt;
 * a passphrase would add an unlock prompt on every launch, which field workers
 * found too slow in the scope of this project.
 */

export interface EncryptedBlob {
  iv: Uint8Array;
  data: ArrayBuffer;
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  return { iv, data };
}

export async function decrypt(blob: EncryptedBlob, key: CryptoKey): Promise<string> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: blob.iv as BufferSource }, key, blob.data);
  return decoder.decode(plain);
}

export async function encryptJson(value: unknown, key: CryptoKey): Promise<EncryptedBlob> {
  return encrypt(JSON.stringify(value), key);
}

export async function decryptJson<T>(blob: EncryptedBlob, key: CryptoKey): Promise<T> {
  return JSON.parse(await decrypt(blob, key)) as T;
}
