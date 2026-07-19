import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  collectFingerprint,
  getOrCreateBrowserId,
  detectAutomation,
  collectIsLikelyMobile,
  collectIdentity,
  collectHardware,
  collectGraphics,
  collectCanvasFingerprint,
} from '../src/collector.js';

describe('collectFingerprint', () => {
  it('returns DeviceInfo with all required fields', () => {
    const fp = collectFingerprint();

    expect(fp).toHaveProperty('browserId');
    expect(fp).toHaveProperty('network');
    expect(fp).toHaveProperty('identity');
    expect(fp).toHaveProperty('hardware');
    expect(fp).toHaveProperty('graphics');
    expect(fp).toHaveProperty('canvasFingerprint');
    expect(fp).toHaveProperty('isLikelyMobile');
    expect(fp).toHaveProperty('collectedAt');
  });

  it('includes network.ip as empty string (server uses observed IP)', () => {
    const fp = collectFingerprint();
    expect(fp.network).toEqual({ ip: '' });
  });

  it('browserId is UUID format', () => {
    const fp = collectFingerprint();
    expect(fp.browserId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('collectedAt is ISO 8601', () => {
    const fp = collectFingerprint();
    const date = new Date(fp.collectedAt);
    expect(date.toISOString()).toBe(fp.collectedAt);
  });

  it('identity has correct types', () => {
    const fp = collectFingerprint();
    expect(typeof fp.identity.userAgent).toBe('string');
    expect(typeof fp.identity.language).toBe('string');
    expect(typeof fp.identity.timeZone).toBe('string');
  });

  it('hardware has correct types', () => {
    const fp = collectFingerprint();
    expect(typeof fp.hardware.cpuCores).toBe('number');
    expect(typeof fp.hardware.deviceMemory).toBe('number');
    expect(typeof fp.hardware.maxTouchPoints).toBe('number');
    expect(typeof fp.hardware.devicePixelRatio).toBe('number');
    expect(typeof fp.hardware.screenResolution).toBe('string');
    expect(typeof fp.hardware.orientation).toBe('string');
    expect(typeof fp.hardware.isAutomated).toBe('boolean');
  });

  it('graphics has correct types', () => {
    const fp = collectFingerprint();
    expect(typeof fp.graphics.vendor).toBe('string');
    expect(typeof fp.graphics.renderer).toBe('string');
  });

  it('canvasFingerprint is string', () => {
    const fp = collectFingerprint();
    expect(typeof fp.canvasFingerprint).toBe('string');
  });

  it('isLikelyMobile is boolean', () => {
    const fp = collectFingerprint();
    expect(typeof fp.isLikelyMobile).toBe('boolean');
  });
});

describe('getOrCreateBrowserId', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
      length: 0,
      key: vi.fn(() => null),
    });
  });

  it('returns UUID format', () => {
    const id = getOrCreateBrowserId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('persists in localStorage', () => {
    const first = getOrCreateBrowserId();
    const second = getOrCreateBrowserId();
    expect(first).toBe(second);
  });

  it('stores under antifraud_browser_id key', () => {
    const id = getOrCreateBrowserId();
    expect(store['antifraud_browser_id']).toBe(id);
  });
});

describe('detectAutomation', () => {
  it('returns boolean', () => {
    expect(typeof detectAutomation()).toBe('boolean');
  });
});

describe('collectIsLikelyMobile', () => {
  it('returns boolean', () => {
    expect(typeof collectIsLikelyMobile()).toBe('boolean');
  });
});

describe('collectIdentity', () => {
  it('returns object with userAgent, language, timeZone', () => {
    const identity = collectIdentity();
    expect(identity).toHaveProperty('userAgent');
    expect(identity).toHaveProperty('language');
    expect(identity).toHaveProperty('timeZone');
  });
});

describe('collectHardware', () => {
  it('returns object with all hardware fields', () => {
    const hw = collectHardware();
    expect(hw).toHaveProperty('cpuCores');
    expect(hw).toHaveProperty('deviceMemory');
    expect(hw).toHaveProperty('maxTouchPoints');
    expect(hw).toHaveProperty('devicePixelRatio');
    expect(hw).toHaveProperty('screenResolution');
    expect(hw).toHaveProperty('orientation');
    expect(hw).toHaveProperty('isAutomated');
  });
});

describe('collectGraphics', () => {
  it('returns object with vendor and renderer', () => {
    const gfx = collectGraphics();
    expect(gfx).toHaveProperty('vendor');
    expect(gfx).toHaveProperty('renderer');
  });
});

describe('collectCanvasFingerprint', () => {
  it('returns string', () => {
    const hash = collectCanvasFingerprint();
    expect(typeof hash).toBe('string');
  });
});
