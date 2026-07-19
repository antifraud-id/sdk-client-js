# Antifraud SDK - Basic Example

## Running the Example

```bash
# From the project root
npx serve examples/basic
```

Then open `http://localhost:3000` in your browser.

## What This Example Shows

1. **Initialize SDK** - Configures the Antifraud SDK with project ID and public key
2. **Collect Fingerprint** - Gathers browser signals (hardware, graphics, canvas, etc.)
3. **Create Session** - Encrypts fingerprint and exchanges it for a session ID
