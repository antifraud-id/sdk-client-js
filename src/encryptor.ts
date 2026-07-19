import { pemToArrayBuffer, uint8ArrayToBase64, isSecureContext } from './utils.js';

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

let cachedRsaKey: CryptoKey | null = null;
let cachedPem: string | null = null;

/**
 * Import RSA public key from PEM. Caches the CryptoKey for repeated calls.
 */
async function importRsaKey(publicKeyPEM: string): Promise<CryptoKey> {
  if (cachedRsaKey && cachedPem === publicKeyPEM) {
    return cachedRsaKey;
  }

  const derBuffer = pemToArrayBuffer(publicKeyPEM);
  cachedRsaKey = await crypto.subtle.importKey(
    'spki',
    derBuffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
  cachedPem = publicKeyPEM;
  return cachedRsaKey;
}

/**
 * Hybrid RSA-OAEP + AES-256-GCM encryption.
 *
 * Wire format (binary → base64):
 *   [4-byte BE rsaKeyLen][RSA-OAEP(AES key)][nonce(12B) ‖ AES-GCM ciphertext+tag]
 *
 * Must match server's decryptHybrid at internal/crypto/rsa.go:113-156.
 */
export async function encryptPayload(
  publicKeyPEM: string,
  plaintextJSON: string
): Promise<string> {
  if (!isSecureContext()) {
    throw new EncryptionError(
      'Antifraud SDK requires a secure context (HTTPS or localhost). ' +
      'crypto.subtle is not available on insecure pages.'
    );
  }

  let aesKey: Uint8Array<ArrayBuffer> | null = null;
  let plaintextBytes: Uint8Array<ArrayBuffer> | null = null;

  try {
    // 1. Import RSA public key
    const rsaKey = await importRsaKey(publicKeyPEM);

    // 2. Generate random 32-byte AES key
    aesKey = new Uint8Array(32);
    crypto.getRandomValues(aesKey);

    // 3. Encrypt AES key with RSA-OAEP-SHA256
    const rsaCiphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaKey, aesKey!)
    );

    // 4. Import AES key for GCM
    const aesCryptoKey = await crypto.subtle.importKey(
      'raw',
      aesKey!,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // 5. Encrypt plaintext with AES-256-GCM
    const nonce = new Uint8Array(12); // 96-bit nonce
    crypto.getRandomValues(nonce);
    
    plaintextBytes = new TextEncoder().encode(plaintextJSON);
    const aesCiphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        aesCryptoKey,
        plaintextBytes!
      )
    );

    // 6. Build wire format: [4-byte BE rsaKeyLen][rsaCT][nonce ‖ aesCT]
    const rsaKeyLen = rsaCiphertext.length;
    const header = new ArrayBuffer(4);
    new DataView(header).setUint32(0, rsaKeyLen, false); // big-endian

    const result = new Uint8Array(4 + rsaKeyLen + nonce.length + aesCiphertext.length);
    result.set(new Uint8Array(header), 0);
    result.set(rsaCiphertext, 4);
    result.set(nonce, 4 + rsaKeyLen);
    result.set(aesCiphertext, 4 + rsaKeyLen + nonce.length);

    // 7. Base64 encode
    return uint8ArrayToBase64(result);
  } catch (err: any) {
    if (err instanceof EncryptionError) {
      throw err;
    }
    throw new EncryptionError(`Encryption failed: ${err.message || err}`);
  } finally {
    if (aesKey) aesKey.fill(0);
    if (plaintextBytes) plaintextBytes.fill(0);
  }
}

/**
 * Reset cached RSA key (for testing).
 */
export function _resetCache(): void {
  cachedRsaKey = null;
  cachedPem = null;
}
