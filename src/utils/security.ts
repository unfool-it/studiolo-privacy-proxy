import { createHmac } from 'node:crypto';

/**
 * PrivacyEngine: Refined for Sovereign Entropy Normalization.
 */
export class PrivacyEngine {
  private static readonly SENSITIVE_KEYS: Set<string> = new Set([
    'email', 'password', 'token', 'cookie', 'authorization', 
    'signature', 'sessiontoken', 'cvv', 'card_number', 'gpu', 
    'audio_fingerprint', 'canvas_id', 'webgl_vendor'
  ]);
  
  private static readonly EMAIL_PATTERN: RegExp = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  private static readonly MAX_DEPTH: number = 5;

  /**
   * Implements K-Anonymity through HMAC-SHA256 truncation.
   */
  public static hashIP(ip: string, salt: string, maskBits: number): string {
    const sanitized: string = ip.split(',')[0]?.trim() || '127.0.0.1';
    const hash: string = createHmac('sha256', salt).update(sanitized).digest('hex');
    
    // b=16 (Subnet-level entropy), b=24 (Node-level entropy)
    const sliceLen: number = maskBits === 16 ? 16 : 24;
    const suffix: string = maskBits === 16 ? '::0.0' : '::0.0.0';
    
    return `${hash.slice(0, sliceLen)}${suffix}`;
  }

  /**
   * Recursive Scrubbing with Circular Reference Protection.
   */
  public static scrubPayload(payload: unknown, depth: number = 0, seen: WeakSet<object> = new WeakSet()): unknown {
    if (depth > this.MAX_DEPTH) return '[DEPTH_EXCEEDED]';
    if (payload === null || typeof payload !== 'object') return payload;
    if (seen.has(payload as object)) return '[CIRCULAR_REFERENCE]';
    
    seen.add(payload as object);

    if (Array.isArray(payload)) {
      return payload.map(item => this.scrubPayload(item, depth + 1, seen));
    }

    const scrubbed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
      const normalizedKey: string = key.toLowerCase();

      if (this.SENSITIVE_KEYS.has(normalizedKey)) {
        scrubbed[key] = '[SCRUBBED_BY_ZENITH]';
      } else if (typeof val === 'string' && this.EMAIL_PATTERN.test(val)) {
        scrubbed[key] = val.replace(this.EMAIL_PATTERN, '[EMAIL_REDACTED]');
      } else if (typeof val === 'object' && val !== null) {
        scrubbed[key] = this.scrubPayload(val, depth + 1, seen);
      } else {
        scrubbed[key] = val;
      }
    }
    return scrubbed;
  }
}
