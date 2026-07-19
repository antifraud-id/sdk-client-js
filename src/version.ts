declare const __ANTIFRAUD_SDK_VERSION__: string | undefined;

// Replaced at build time by Vite's `define` config.
// In dev/test, falls back to reading from the environment or a hardcoded default.
export const SDK_VERSION: string =
  typeof __ANTIFRAUD_SDK_VERSION__ !== 'undefined' ? __ANTIFRAUD_SDK_VERSION__ : 'dev';
