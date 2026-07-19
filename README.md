# @antifraud/sdk-client-js

Antifraud Web Browser SDK — collects browser fingerprint signals, encrypts them with hybrid RSA-OAEP + AES-256-GCM, and exchanges them for a `session_id` via `POST /v1/session`.

## Installation

### CDN URL Scheme

| URL | Purpose | Caching |
|---|---|---|
| `https://sdk.antifraud.id/v{version}/antifraud.min.js` | **Production (recommended)** | `Cache-Control: public, max-age=31536000, immutable` |
| `https://sdk.antifraud.id/antifraud.min.js` | Prototyping — redirects to latest version | Short TTL, not for SRI |

Use the versioned URL in production. It is immutable — the content never changes for a given version — so browsers and CDNs can cache it aggressively and SRI hashes remain stable.

### Script Tag (IIFE)

```html
<!-- Production: pin a version, add SRI -->
<script
  src="https://sdk.antifraud.id/v0.1.0/antifraud.min.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
<script>
  const antifraud = Antifraud.init({ projectId: '...', publicKey: '...' });
</script>
```

Quick prototyping (not for production):

```html
<script src="https://sdk.antifraud.id/antifraud.min.js"></script>
```

### npm

```bash
npm install @antifraud/sdk-client-js
```

```ts
import { Antifraud } from '@antifraud/sdk-client-js';

const antifraud = Antifraud.init({
  projectId: '45608b8c-ed39-4ce8-8607-81a4cd26deed',
  publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`,
});
```

## Quick Start

```ts
import { Antifraud } from '@antifraud/sdk-client-js';

const antifraud = Antifraud.init({
  projectId: '45608b8c-ed39-4ce8-8607-81a4cd26deed',
  publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----',
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const { sessionId } = await antifraud.createSession();

    // Send sessionId to your backend
    await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        antifraud_session_id: sessionId,
      }),
    });
  } catch (err) {
    console.error('Antifraud session error:', err);
    // Proceed without scoring (fail-open)
  }
});
```

## API Reference

### `Antifraud.init(config)`

Initializes the SDK and returns an `AntifraudClient` instance.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `projectId` | `string` | yes | — | Your project ID |
| `publicKey` | `string` | yes | — | RSA public key (PEM format) |
| `apiUrl` | `string` | no | `https://api.antifraud.id` | API base URL |
| `timeout` | `number` | no | `5000` | HTTP timeout in ms |
| `autoCollect` | `boolean` | no | `true` | Collect on init |

### `AntifraudClient`

#### `collect(): DeviceInfo`

Returns the raw (unencrypted) fingerprint object for inspection.

#### `createSession(): Promise<SessionResult>`

Collects, encrypts, and exchanges the fingerprint for a `session_id`. Concurrent calls are deduped — if a request is in-flight, the same promise is returned.

Returns `{ sessionId: string }`.

## Merchant Integration Checklist

### Content Security Policy (CSP)

Add these directives to your CSP headers:

```
connect-src https://api.antifraud.id
script-src https://sdk.antifraud.id
```

### CORS

The server must return `Access-Control-Allow-Origin` and allow the `X-Antifraud-Project-ID` header for browser requests to succeed.

### Subresource Integrity (SRI)

Pin the SDK version with an integrity hash. Use the versioned URL — the content is immutable per version, so the hash will never change:

```html
<script
  src="https://sdk.antifraud.id/v0.1.0/antifraud.min.js"
  integrity="sha384-<hash>"
  crossorigin="anonymous"
></script>
```

To generate the hash for a release:

```bash
cat dist/antifraud.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

## Ad Blocker Mitigation

Privacy lists (EasyPrivacy, Fanboy) may block fingerprinting scripts by filename or CDN domain. Mitigations:

- Serve the SDK from your own domain (reverse proxy `sdk.antifraud.id`)
- Versioned URLs (`/v0.1.0/antifraud.min.js`) are less likely to match static blocklist patterns than unversioned paths
- The absence of an SDK call is itself a signal for the scoring model

## Privacy & Compliance

Device fingerprinting for fraud prevention is generally treated as legitimate interest under GDPR / ePrivacy. This varies by jurisdiction. Consult with your legal counsel.

## browserId Behavior

The `browserId` is stored in `localStorage` and persists across page loads. It is:

- **Volatile** — cleared in private/incognito mode and by manual browser clear
- **Resettable** — user can clear it at any time
- **Weak identity signal** — not a durable user ID; the scoring model should treat it accordingly

## Error Handling

The SDK throws typed errors. Use a try/catch with fail-open pattern:

```ts
try {
  const { sessionId } = await antifraud.createSession();
} catch (err) {
  if (err.name === 'RateLimitError') { /* 429 */ }
  if (err.name === 'TimeoutError') { /* request timed out */ }
  if (err.name === 'ServerError') { /* 5xx */ }
  if (err.name === 'EncryptionError') { /* not HTTPS */ }
  // Proceed without scoring (fail-open)
}
```

## Browser Support

| Browser | Minimum Version |
|---|---|
| Chrome | 63+ |
| Firefox | 57+ |
| Safari | 11+ |
| Edge | 79+ |

All support `crypto.subtle` (requires HTTPS or localhost).

## Build from Source

```bash
npm install
npm run build      # → dist/antifraud.min.js, dist/antifraud.esm.js, dist/antifraud.cjs.js
npm run typecheck  # TypeScript type checking
npm run test       # Unit tests
```

## License

MIT
