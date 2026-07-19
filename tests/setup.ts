import { webcrypto } from 'node:crypto';

// jsdom replaces globalThis.crypto with its own incomplete polyfill that
// wraps Node's WebCrypto and fails on ArrayBuffer instanceof checks.
// Restore the real Node WebCrypto so crypto.subtle works in tests.
vi.stubGlobal('crypto', webcrypto);
