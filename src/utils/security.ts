/**
 * FILE: src/utils/security.ts
 * Refined for Sovereign Entropy Normalization and Thread-Safe Scrubbing.
 */
import { createHmac } from 'node:crypto';

export class PrivacyEngine {
  private static readonly SENSITIVE_KEYS: Set<string> = new Set([
    'email', 'password', 'token', 'cookie', 'authorization', 
    'signature', 'sessiontoken', 'cvv', 'card_number', 'gpu', 
    'audio_fingerprint', 'canvas_id', 'webgl_vendor'
  ]);
  
  // Removed global flag to prevent stateful matching issues in a shared context
  private static readonly EMAIL_PATTERN: RegExp = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  private static readonly MAX_DEPTH: number = 5;

  public static hashIP(ip: string, salt: string, maskBits: number): string {
    const sanitized: string = ip.split(',')[0]?.trim() || '127.0.0.1';
    const hash: string = createHmac('sha256', salt).update(sanitized).digest('hex');
    
    const sliceLen: number = maskBits === 16 ? 16 : 24;
    const suffix: string = maskBits === 16 ? '::0.0' : '::0.0.0';
    
    return `${hash.slice(0, sliceLen)}${suffix}`;
  }

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
        // Redaction logic using a local, fresh regex instance for safety
        scrubbed[key] = val.replace(new RegExp(this.EMAIL_PATTERN, 'g'), '[EMAIL_REDACTED]');
      } else if (typeof val === 'object' && val !== null) {
        scrubbed[key] = this.scrubPayload(val, depth + 1, seen);
      } else {
        scrubbed[key] = val;
      }
    }
    return scrubbed;
  }
}
