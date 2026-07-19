import { webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';

// Helper to convert JSDOM ArrayBuffer/TypedArray/DataView to Node-native Buffer
function toNode(val: any): any {
  if (!val || typeof val !== 'object') {
    return val;
  }

  // If it's a TypedArray view (like Uint8Array, etc.) or DataView
  if (ArrayBuffer.isView(val)) {
    return Buffer.from(val.buffer, val.byteOffset, val.byteLength);
  }

  // If it's an ArrayBuffer itself
  if (val instanceof ArrayBuffer || val.constructor?.name === 'ArrayBuffer') {
    return Buffer.from(val);
  }

  // If it's a plain object (like the algorithm object containing iv/salt)
  if (Object.getPrototypeOf(val) === Object.prototype) {
    const newVal: any = {};
    for (const key of Object.keys(val)) {
      newVal[key] = toNode(val[key]);
    }
    return newVal;
  }

  // If it's an array
  if (Array.isArray(val)) {
    return val.map(toNode);
  }

  return val;
}

const subtleProxy = new Proxy(webcrypto.subtle, {
  get(target, prop) {
    const originalMethod = target[prop as keyof typeof target];
    if (typeof originalMethod === 'function') {
      return function (this: any, ...args: any[]) {
        const nodeArgs = args.map(toNode);
        return (originalMethod as Function).apply(target, nodeArgs);
      };
    }
    return originalMethod;
  }
});

const cryptoProxy = new Proxy(webcrypto, {
  get(target, prop) {
    if (prop === 'subtle') {
      return subtleProxy;
    }
    if (prop === 'getRandomValues') {
      return function (typedArray: any) {
        const nodeBuf = toNode(typedArray);
        const result = webcrypto.getRandomValues(nodeBuf);
        if (typedArray && typeof typedArray.set === 'function') {
          typedArray.set(result);
        }
        return typedArray;
      };
    }
    const val = target[prop as keyof typeof target];
    if (typeof val === 'function') {
      return val.bind(target);
    }
    return val;
  }
});

// jsdom replaces globalThis.crypto with its own incomplete polyfill that
// wraps Node's WebCrypto and fails on ArrayBuffer instanceof checks.
// Restore the real Node WebCrypto (with JSDOM-to-Node buffer proxying)
// so crypto.subtle works in tests in Node 20.
vi.stubGlobal('crypto', cryptoProxy);
