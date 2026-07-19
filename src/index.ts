import type { AntifraudConfig, SessionResult, DeviceInfo, WebSDKPayload } from './fingerprint.js';
import { AntifraudClient, createClient } from './client.js';
import { isSecureContext } from './utils.js';

function validateConfig(config: AntifraudConfig): void {
  if (!config.projectId) {
    throw new Error('Antifraud: projectId is required');
  }
  if (!config.publicKey || !config.publicKey.includes('-----BEGIN PUBLIC KEY-----')) {
    throw new Error('Antifraud: publicKey must be a PEM-encoded RSA public key');
  }
  if (!isSecureContext()) {
    throw new Error(
      'Antifraud: requires a secure context (HTTPS or localhost). ' +
      'crypto.subtle is not available on insecure pages.'
    );
  }
}

/**
 * Initialize the Antifraud SDK.
 *
 * @example
 * ```ts
 * import { Antifraud } from '@antifraud/sdk-client-js';
 *
 * const antifraud = Antifraud.init({
 *   projectId: '45608b8c-ed39-4ce8-8607-81a4cd26deed',
 *   publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----',
 * });
 *
 * const { sessionId } = await antifraud.createSession();
 * ```
 */
export const Antifraud = {
  init(config: AntifraudConfig): AntifraudClient {
    validateConfig(config);
    return createClient(config);
  },
};

export default Antifraud;

export type { AntifraudConfig, SessionResult, DeviceInfo, WebSDKPayload };
export { AntifraudClient } from './client.js';
export { EncryptionError } from './encryptor.js';
export { SDK_VERSION } from './version.js';
