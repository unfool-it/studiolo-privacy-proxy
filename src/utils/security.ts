// src/utils/security.ts
import { createHmac } from 'node:crypto';

export type ScrubbedResult = {
  data: unknown;
  serializedLength: number;
};

export class PrivacyEngine {
  private static readonly SENSITIVE_KEYS = new Set([
    'email', 'password', 'token', 'cookie', 'authorization', 'signature', 'sessiontoken'
  ]);
  
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly MAX_DEPTH = 10;

  /**
   * Performs cryptographic truncation on IP addresses.
   * Logic: Truncates the HMAC-SHA256 hash to the specified bit-depth.
   */
  public static hashIP(ip: string, salt: string, maskBits: number): string {
    const sanitized = ip.split(',')[0].trim();
    const hmac = createHmac('sha256', salt).update(sanitized).digest('hex');
    
    // Each hex char represents 4 bits.
    const hexChars = Math.max(4, Math.floor(maskBits / 4));
    return `${hmac.substring(0, hexChars)}::[ANONYMIZED]`;
  }

  /**
   * Recursively redacts PII with depth-guarding to prevent Stack Overflow.
   */
  public static scrubPayload(payload: unknown, depth: number = 0, seen = new WeakSet()): unknown {
    if (depth > this.MAX_DEPTH) return '[DEPTH_EXCEEDED]';
    if (payload === null || typeof payload !== 'object') return payload;
    if (seen.has(payload)) return '[Circular]';
    
    seen.add(payload);
    const scrubbed: Record<string, any> = Array.isArray(payload) ? [] : {};
    
    for (const [key, val] of Object.entries(payload)) {
      if (this.SENSITIVE_KEYS.has(key.toLowerCase())) {
        scrubbed[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        scrubbed[key] = this.scrubPayload(val, depth + 1, seen);
      } else if (typeof val === 'string' && this.EMAIL_REGEX.test(val)) {
        scrubbed[key] = '[EMAIL_REDACTED]';
      } else {
        scrubbed[key] = val;
      }
    }
    return scrubbed;
  }
}

// src/services/UtilityService.ts
import { PrivacyEngine } from '../utils/security.js';
import { ConfigLoader } from '../config/index.js';

export class UtilityService {
  private static instance: UtilityService;
  private readonly telemetryBuffer: SharedArrayBuffer;
  private readonly countView: Int32Array;
  private readonly bytesView: BigUint64Array;

  private constructor() {
    // 64-byte aligned allocation
    this.telemetryBuffer = new SharedArrayBuffer(64);
    // Index 0: Request Counter (4 bytes)
    this.countView = new Int32Array(this.telemetryBuffer, 0, 1);
    // Index 1 (Offset 8): Total Bytes (8 bytes, must be 8-byte aligned)
    this.bytesView = new BigUint64Array(this.telemetryBuffer, 8, 1);
  }

  public static getInstance(): UtilityService {
    if (!UtilityService.instance) {
      UtilityService.instance = new UtilityService();
    }
    return UtilityService.instance;
  }

  public processRequest(ip: string, payload: unknown): { anonymizedId: string; payload: unknown } {
    const config = ConfigLoader.getInstance().getConfig();
    const anonymizedId = PrivacyEngine.hashIP(ip, config.salt, config.maskBits);
    const scrubbed = PrivacyEngine.scrubPayload(payload);

    // Atomic telemetry updates
    const length = BigInt(JSON.stringify(scrubbed).length);
    Atomics.add(this.countView, 0, 1);
    Atomics.add(this.bytesView, 0, length);

    return { anonymizedId, payload: scrubbed };
  }

  public getMetrics() {
    return {
      requestCount: Atomics.load(this.countView, 0),
      totalBytesScrubbed: Atomics.load(this.bytesView, 0).toString()
    };
  }
}
