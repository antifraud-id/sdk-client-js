import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encryptPayload, EncryptionError, _resetCache } from '../src/encryptor.js';

describe('encryptPayload', () => {
  beforeEach(() => {
    _resetCache();
  });

  afterEach(() => {
    // Clean up any mocked isSecureContext
    delete (window as any).isSecureContext;
  });

  it('throws EncryptionError when not in secure context', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });

    await expect(
      encryptPayload('-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----', '{}')
    ).rejects.toThrow(EncryptionError);
  });

  it('produces base64-encoded output', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );

    const pubKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const pubKeyBytes = new Uint8Array(pubKeyDer);
    const pubKeyB64 = btoa(String.fromCharCode(...pubKeyBytes));
    const pubKeyPEM = `-----BEGIN PUBLIC KEY-----\n${pubKeyB64}\n-----END PUBLIC KEY-----`;

    const plaintext = JSON.stringify({ deviceInfo: { browserId: 'test' } });
    const result = await encryptPayload(pubKeyPEM, plaintext);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);

    // Should be valid base64
    const decoded = atob(result);
    expect(decoded.length).toBeGreaterThan(0);
  });

  it('wire format: first 4 bytes encode RSA ciphertext length', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );

    const pubKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const pubKeyBytes = new Uint8Array(pubKeyDer);
    const pubKeyB64 = btoa(String.fromCharCode(...pubKeyBytes));
    const pubKeyPEM = `-----BEGIN PUBLIC KEY-----\n${pubKeyB64}\n-----END PUBLIC KEY-----`;

    const plaintext = JSON.stringify({ test: 'data' });
    const result = await encryptPayload(pubKeyPEM, plaintext);

    // Decode base64 to bytes
    const raw = Uint8Array.from(atob(result), (c) => c.charCodeAt(0));

    // First 4 bytes = big-endian RSA ciphertext length
    const view = new DataView(raw.buffer, raw.byteOffset, 4);
    const rsaKeyLen = view.getUint32(0, false); // big-endian

    // For 2048-bit RSA, ciphertext should be 256 bytes
    expect(rsaKeyLen).toBe(256);

    // Total length should be 4 + rsaKeyLen + nonce(12) + aesCT(at least 1 tag=16)
    expect(raw.length).toBeGreaterThan(4 + rsaKeyLen + 12 + 16);
  });

  it('roundtrip: encrypt with JS, decrypt with Web Crypto', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );

    const pubKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const pubKeyBytes = new Uint8Array(pubKeyDer);
    const pubKeyB64 = btoa(String.fromCharCode(...pubKeyBytes));
    const pubKeyPEM = `-----BEGIN PUBLIC KEY-----\n${pubKeyB64}\n-----END PUBLIC KEY-----`;

    const originalPayload = JSON.stringify({
      deviceInfo: {
        browserId: '550e8400-e29b-41d4-a716-446655440000',
        network: { ip: '' },
        identity: { userAgent: 'test', language: 'en', timeZone: 'UTC' },
        hardware: {
          cpuCores: 4, deviceMemory: 8, maxTouchPoints: 0,
          devicePixelRatio: 1, screenResolution: '1920x1080',
          orientation: 'landscape-primary', isAutomated: false,
        },
        graphics: { vendor: '', renderer: '' },
        canvasFingerprint: '',
        isLikelyMobile: false,
        collectedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const encrypted = await encryptPayload(pubKeyPEM, originalPayload);

    // Decode the wire format
    const raw = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const view = new DataView(raw.buffer, raw.byteOffset, 4);
    const rsaKeyLen = view.getUint32(0, false);

    const rsaCT = raw.slice(4, 4 + rsaKeyLen);
    const aesPart = raw.slice(4 + rsaKeyLen);
    const nonce = aesPart.slice(0, 12);
    const aesCT = aesPart.slice(12);

    // Decrypt AES key with RSA-OAEP
    const aesKeyBuf = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      keyPair.privateKey,
      rsaCT
    );
    const aesKey = new Uint8Array(aesKeyBuf);
    expect(aesKey.length).toBe(32);

    // Import AES key and decrypt
    const aesCryptoKey = await crypto.subtle.importKey(
      'raw',
      aesKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      aesCryptoKey,
      aesCT
    );

    const decrypted = new TextDecoder().decode(decryptedBuf);
    expect(decrypted).toBe(originalPayload);
  });

  it('produces different ciphertexts for same input (random nonce)', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );

    const pubKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const pubKeyBytes = new Uint8Array(pubKeyDer);
    const pubKeyB64 = btoa(String.fromCharCode(...pubKeyBytes));
    const pubKeyPEM = `-----BEGIN PUBLIC KEY-----\n${pubKeyB64}\n-----END PUBLIC KEY-----`;

    const plaintext = '{"test":"data"}';
    const a = await encryptPayload(pubKeyPEM, plaintext);
    const b = await encryptPayload(pubKeyPEM, plaintext);

    // Different due to random AES key + nonce
    expect(a).not.toBe(b);
  });
});
