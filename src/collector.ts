import type { DeviceInfo, IdentitySignals, HardwareSignals, GraphicsSignals } from './fingerprint.js';
import { safeGet, generateUUID, fnv1aHash } from './utils.js';

const BROWSER_ID_KEY = 'antifraud_browser_id';

/**
 * Get or create a stable browser ID persisted in localStorage.
 * Falls back to an ephemeral UUID if localStorage is unavailable.
 */
export function getOrCreateBrowserId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      let id = localStorage.getItem(BROWSER_ID_KEY);
      if (!id) {
        id = generateUUID();
        localStorage.setItem(BROWSER_ID_KEY, id);
      }
      return id;
    }
  } catch {
    // Handle sandboxed contexts or disabled storage gracefully
  }
  return generateUUID();
}

/**
 * Collect identity signals: userAgent, language, timeZone.
 */
export function collectIdentity(): IdentitySignals {
  return {
    userAgent: safeGet(() => navigator.userAgent, ''),
    language: safeGet(() => navigator.language, ''),
    timeZone: safeGet(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      ''
    ),
  };
}

/**
 * Bot / automation detection heuristics.
 * Returns true if any check triggers. Each check is a weak signal.
 */
export function detectAutomation(): boolean {
  return safeGet(() => {
    // Selenium / Puppeteer webdriver flag
    if ((navigator as any).webdriver === true) return true;

    // Headless Chrome
    if (/HeadlessChrome/.test(navigator.userAgent)) return true;

    // PhantomJS
    if ((window as any)._phantom || (window as any).__phantom) return true;

    // Nightmare.js
    if ((window as any).__nightmare) return true;

    // ChromeDriver artifacts ($cdc_ / $wdc_) — weak signal, randomized in newer versions
    if ((document as any).$cdc_ || (document as any).$wdc_) return true;

    // Empty plugins on desktop (weak signal — modern Chrome deprecated NPAPI)
    if (
      !/Mobi/.test(navigator.userAgent) &&
      navigator.plugins &&
      navigator.plugins.length === 0
    ) {
      return true;
    }

    // Empty languages array
    if (navigator.languages && navigator.languages.length === 0) return true;

    return false;
  }, false);
}

/**
 * Collect hardware signals.
 */
export function collectHardware(): HardwareSignals {
  return {
    cpuCores: safeGet(() => navigator.hardwareConcurrency || 0, 0),
    deviceMemory: safeGet(() => (navigator as any).deviceMemory || 0, 0),
    maxTouchPoints: safeGet(() => navigator.maxTouchPoints || 0, 0),
    devicePixelRatio: safeGet(() => window.devicePixelRatio || 0, 0),
    screenResolution: safeGet(
      () => `${screen.width}x${screen.height}`,
      ''
    ),
    orientation: safeGet(
      () => screen.orientation?.type || '',
      ''
    ),
    isAutomated: detectAutomation(),
  };
}

/**
 * Collect WebGL graphics info (vendor + renderer).
 */
let cachedGraphics: GraphicsSignals | null = null;

export function collectGraphics(): GraphicsSignals {
  if (cachedGraphics) return cachedGraphics;

  cachedGraphics = safeGet(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return { vendor: '', renderer: '' };

    try {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) return { vendor: '', renderer: '' };

      return {
        vendor:
          (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '',
        renderer:
          (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '',
      };
    } finally {
      const loseContext = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }
  }, { vendor: '', renderer: '' });

  return cachedGraphics;
}

/**
 * Generate a canvas fingerprint hash.
 * Renders specific text/shapes, converts to dataURL, then FNV-1a hashes it.
 */
let cachedCanvasFingerprint: string | null = null;

export function collectCanvasFingerprint(): string {
  if (cachedCanvasFingerprint !== null) return cachedCanvasFingerprint;

  cachedCanvasFingerprint = safeGet(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Antifraud-fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('Antifraud-fingerprint', 4, 17);

    const dataUrl = canvas.toDataURL();
    return fnv1aHash(dataUrl);
  }, '');

  return cachedCanvasFingerprint;
}

/**
 * Check if the device is likely mobile based on userAgent.
 */
export function collectIsLikelyMobile(): boolean {
  return safeGet(() => /Mobi/.test(navigator.userAgent), false);
}

/**
 * Assemble the full DeviceInfo payload.
 * Matches model.WebSDKPayload (internal/model/sdk_payload.go:14-23).
 */
export function collectFingerprint(): DeviceInfo {
  return {
    browserId: getOrCreateBrowserId(),
    network: { ip: '' },
    identity: collectIdentity(),
    hardware: collectHardware(),
    graphics: collectGraphics(),
    canvasFingerprint: collectCanvasFingerprint(),
    isLikelyMobile: collectIsLikelyMobile(),
    collectedAt: new Date().toISOString(),
  };
}
