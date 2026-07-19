/**
 * safeGet — try/catch wrapper for collector signals.
 * One failing API never kills the whole payload.
 */
export function safeGet<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Generate a UUID v4.
 * Uses crypto.randomUUID() when available, otherwise manual fallback.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: manual UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Strip PEM armor and decode base64 to ArrayBuffer.
 */
export function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Chunked base64 encoding — safe for large Uint8Arrays.
 * Avoids call-stack overflow from `btoa(String.fromCharCode(...bytes))`.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, bytes.length);
    let str = '';
    for (let j = i; j < end; j++) {
      str += String.fromCharCode(bytes[j]);
    }
    chunks.push(str);
  }
  return btoa(chunks.join(''));
}

/**
 * FNV-1a 32-bit hash → 8-char hex string.
 * Used for canvas fingerprinting.
 */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, unsigned
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Check if the current context supports crypto.subtle.
 * Requires HTTPS or localhost.
 */
export function isSecureContext(): boolean {
  if (typeof window !== 'undefined' && typeof window.isSecureContext === 'boolean') {
    return window.isSecureContext;
  }
  // In Node (test env), assume secure
  return true;
}
