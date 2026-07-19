import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AntifraudClient, createClient } from '../src/client.js';
import { SDK_VERSION } from '../src/version.js';

describe('AntifraudClient', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('version header', () => {
    it('SDK_VERSION is defined', () => {
      expect(typeof SDK_VERSION).toBe('string');
      expect(SDK_VERSION.length).toBeGreaterThan(0);
    });

    it('sends X-Antifraud-SDK-Version header in createSession request', async () => {
      // Mock crypto.subtle for encryption
      const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['encrypt', 'decrypt']
      );
      const pubKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
      const pubKeyB64 = btoa(String.fromCharCode(...new Uint8Array(pubKeyDer)));
      const pubKeyPEM = `-----BEGIN PUBLIC KEY-----\n${pubKeyB64}\n-----END PUBLIC KEY-----`;

      // Mock successful response
      fetchSpy.mockResolvedValueOnce({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ session_id: 'test-session-123' })),
      });

      const client = createClient({
        projectId: 'test-project',
        publicKey: pubKeyPEM,
        apiUrl: 'https://api.test.com',
        timeout: 5000,
        autoCollect: false,
      });

      await client.createSession();

      // Verify fetch was called
      expect(fetchSpy).toHaveBeenCalledOnce();

      // Verify headers
      const [, options] = fetchSpy.mock.calls[0];
      expect(options.headers).toHaveProperty('X-Antifraud-SDK-Version');
      expect(options.headers['X-Antifraud-SDK-Version']).toBe(SDK_VERSION);
    });

    it('sends X-Antifraud-Project-ID header alongside version', async () => {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
        true,
        ['encrypt', 'decrypt']
      );
      const pubKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
      const pubKeyB64 = btoa(String.fromCharCode(...new Uint8Array(pubKeyDer)));
      const pubKeyPEM = `-----BEGIN PUBLIC KEY-----\n${pubKeyB64}\n-----END PUBLIC KEY-----`;

      fetchSpy.mockResolvedValueOnce({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ session_id: 'sid' })),
      });

      const client = createClient({
        projectId: 'my-project-id',
        publicKey: pubKeyPEM,
        apiUrl: 'https://api.test.com',
        timeout: 5000,
        autoCollect: false,
      });

      await client.createSession();

      const [, options] = fetchSpy.mock.calls[0];
      expect(options.headers['X-Antifraud-Project-ID']).toBe('my-project-id');
      expect(options.headers['X-Antifraud-SDK-Version']).toBe(SDK_VERSION);
      expect(options.headers['Content-Type']).toBe('application/json');
    });
  });
});
