import type { AntifraudConfig, DeviceInfo, SessionResult, WebSDKPayload } from './fingerprint.js';
import { collectFingerprint } from './collector.js';
import { encryptPayload } from './encryptor.js';
import { SDK_VERSION } from './version.js';

export class AntifraudClientError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'AntifraudClientError';
    this.status = status;
    this.body = body;
  }
}

export class TimeoutError extends AntifraudClientError {
  constructor(timeoutMs: number) {
    super(`Antifraud request timed out after ${timeoutMs}ms`, 0, '');
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends AntifraudClientError {
  constructor(body: string) {
    super('Antifraud rate limit exceeded (429)', 429, body);
    this.name = 'RateLimitError';
  }
}

export class ServerError extends AntifraudClientError {
  constructor(status: number, body: string) {
    super(`Antifraud server error (${status})`, status, body);
    this.name = 'ServerError';
  }
}

const DEFAULT_API_URL = 'https://api.antifraud.id';
const DEFAULT_TIMEOUT = 5000;

export class AntifraudClient {
  private config: Required<AntifraudConfig>;
  private inflightPromise: Promise<SessionResult> | null = null;

  constructor(config: Required<AntifraudConfig>) {
    this.config = config;
  }

  /**
   * Collect browser fingerprint signals (unencrypted).
   * Returns the raw DeviceInfo object for inspection.
   */
  collect(): DeviceInfo {
    return collectFingerprint();
  }

  /**
   * Collect, encrypt, and exchange fingerprint for a session_id.
   * Deduped: concurrent calls return the same promise.
   */
  async createSession(): Promise<SessionResult> {
    if (this.inflightPromise) return this.inflightPromise;
    this.inflightPromise = this._doCreateSession();
    try {
      return await this.inflightPromise;
    } finally {
      this.inflightPromise = null;
    }
  }

  private async _doCreateSession(): Promise<SessionResult> {
    const deviceInfo = this.collect();
    const payload: WebSDKPayload = { deviceInfo };
    const plaintextJSON = JSON.stringify(payload);

    const encrypted = await encryptPayload(this.config.publicKey, plaintextJSON);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.apiUrl}/v1/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Antifraud-Project-ID': this.config.projectId,
          'X-Antifraud-SDK-Version': SDK_VERSION,
        },
        body: JSON.stringify({ payload: encrypted }),
        signal: controller.signal,
      });

      const body = await response.text();

      if (response.status === 429) {
        throw new RateLimitError(body);
      }

      if (response.status >= 400) {
        throw new ServerError(response.status, body);
      }

      const data = JSON.parse(body);
      return { sessionId: data.session_id };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new TimeoutError(this.config.timeout);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createClient(config: AntifraudConfig): AntifraudClient {
  const resolved: Required<AntifraudConfig> = {
    projectId: config.projectId,
    publicKey: config.publicKey,
    apiUrl: config.apiUrl || DEFAULT_API_URL,
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    autoCollect: config.autoCollect ?? true,
  };
  return new AntifraudClient(resolved);
}
