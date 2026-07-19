// Matches model.WebSDKPayload (internal/model/sdk_payload.go:14-23)
// and the surrounding structs at lines 25-48.

export interface WebSDKPayload {
  deviceInfo: DeviceInfo;
}

export interface DeviceInfo {
  browserId: string;
  network: NetworkInfo;
  identity: IdentitySignals;
  hardware: HardwareSignals;
  graphics: GraphicsSignals;
  canvasFingerprint: string;
  isLikelyMobile: boolean;
  collectedAt: string;
}

export interface NetworkInfo {
  ip: string;
}

export interface IdentitySignals {
  userAgent: string;
  language: string;
  timeZone: string;
}

export interface HardwareSignals {
  cpuCores: number;
  deviceMemory: number;
  maxTouchPoints: number;
  devicePixelRatio: number;
  screenResolution: string;
  orientation: string;
  isAutomated: boolean;
}

export interface GraphicsSignals {
  vendor: string;
  renderer: string;
}

export interface AntifraudConfig {
  projectId: string;
  publicKey: string;
  apiUrl?: string;
  timeout?: number;
  autoCollect?: boolean;
}

export interface SessionResult {
  sessionId: string;
}
