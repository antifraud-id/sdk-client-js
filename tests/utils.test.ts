import { describe, it, expect } from 'vitest';
import {
  safeGet,
  generateUUID,
  pemToArrayBuffer,
  uint8ArrayToBase64,
  fnv1aHash,
  isSecureContext,
} from '../src/utils.js';

describe('safeGet', () => {
  it('returns value on success', () => {
    expect(safeGet(() => 42, 0)).toBe(42);
  });

  it('returns fallback on throw', () => {
    expect(safeGet(() => { throw new Error('fail'); }, 99)).toBe(99);
  });

  it('returns fallback on TypeError', () => {
    expect(safeGet(() => (null as any).foo, 'default')).toBe('default');
  });

  it('works with string fallback', () => {
    expect(safeGet(() => 'hello', '')).toBe('hello');
  });

  it('works with boolean fallback', () => {
    expect(safeGet(() => true, false)).toBe(true);
  });
});

describe('generateUUID', () => {
  it('returns valid UUID v4 format', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('returns unique values', () => {
    const a = generateUUID();
    const b = generateUUID();
    expect(a).not.toBe(b);
  });
});

describe('pemToArrayBuffer', () => {
  it('strips PEM armor and decodes to ArrayBuffer', () => {
    // A small base64-encoded payload: "hello"
    const b64 = Buffer.from('hello').toString('base64');
    const pem = `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`;
    const buf = pemToArrayBuffer(pem);
    const decoded = new TextDecoder().decode(new Uint8Array(buf));
    expect(decoded).toBe('hello');
  });

  it('handles multiline PEM content', () => {
    const content = 'AAAAAAAABBBBBBBBCCCCCCCCDDDDDDDD';
    const b64 = Buffer.from(content, 'utf-8').toString('base64');
    const pem = `-----BEGIN PUBLIC KEY-----\n${b64.slice(0, 20)}\n${b64.slice(20)}\n-----END PUBLIC KEY-----`;
    const buf = pemToArrayBuffer(pem);
    const decoded = new TextDecoder().decode(new Uint8Array(buf));
    expect(decoded).toBe(content);
  });
});

describe('uint8ArrayToBase64', () => {
  it('encodes small array correctly', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(uint8ArrayToBase64(bytes)).toBe(btoa('Hello'));
  });

  it('encodes empty array', () => {
    expect(uint8ArrayToBase64(new Uint8Array(0))).toBe('');
  });

  it('roundtrips correctly', () => {
    const original = 'The quick brown fox jumps over the lazy dog';
    const bytes = new TextEncoder().encode(original);
    const b64 = uint8ArrayToBase64(bytes);
    const decoded = atob(b64);
    expect(decoded).toBe(original);
  });

  it('handles large arrays without stack overflow', () => {
    // Use 10001 bytes (larger than chunk size 8192) to verify chunking
    const large = new Uint8Array(10001);
    crypto.getRandomValues(large);
    const b64 = uint8ArrayToBase64(large);
    expect(b64.length).toBeGreaterThan(0);
    const decoded = atob(b64);
    expect(decoded.length).toBe(10001);
  });
});

describe('fnv1aHash', () => {
  it('returns 8-char hex string', () => {
    const hash = fnv1aHash('test');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic', () => {
    expect(fnv1aHash('hello')).toBe(fnv1aHash('hello'));
  });

  it('produces different hashes for different inputs', () => {
    expect(fnv1aHash('hello')).not.toBe(fnv1aHash('world'));
  });

  it('produces known value', () => {
    // FNV-1a of empty string
    const hash = fnv1aHash('');
    expect(hash).toBe('811c9dc5');
  });
});

describe('isSecureContext', () => {
  it('returns a boolean', () => {
    expect(typeof isSecureContext()).toBe('boolean');
  });
});
