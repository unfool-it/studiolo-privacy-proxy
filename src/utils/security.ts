import { createHmac, randomBytes, createCipheriv, createDecipheriv, type Cipher, type Decipher } from 'node:crypto';

/**
 * PrivacyEngine: The core cryptographic and sanitization authority.
 * Implements deterministic identity truncation and recursive PII scrubbing.
 */
export class PrivacyEngine {
  private static readonly SENSITIVE_KEYS = new Set([
    'email', 'password', 'token', 'cookie', 'authorization', 
    'signature', 'sessiontoken', 'cvv', 'card_number'
  ]);
  
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  private static readonly MAX_RECURSION_DEPTH = 10;

  /**
   * Generates a deterministic, anonymized identifier for a network address.
   */
  public static hashIP(ip: string, salt: string, maskBits: number): string {
    const sanitized = ip.split(',')[0]?.trim() || '0.0.0.0';
    const hmac = createHmac('sha256', salt).update(sanitized).digest('hex');
    // Truncate based on mask level to ensure K-Anonymity within the dataset
    return maskBits === 16 ? `${hmac.slice(0, 16)}::0.0` : `${hmac.slice(0, 24)}::0.0.0`;
  }

  /**
   * Recursively audits and redacts PII from dynamic JSON structures.
   * @param payload The raw input object
   * @param depth Current recursion depth to prevent stack exhaustion
   */
  public static scrubPayload(payload: any, depth: number = 0, seen = new WeakSet()): any {
    if (depth > this.MAX_RECURSION_DEPTH) return '[DEPTH_EXCEEDED]';
    if (payload === null || typeof payload !== 'object') return payload;
    if (seen.has(payload)) return '[CIRCULAR_REFERENCE]';
    
    seen.add(payload);

    const scrubbed: any = Array.isArray(payload) ? [] : {};

    for (const [key, val] of Object.entries(payload)) {
      const normalizedKey = key.toLowerCase();

      if (this.SENSITIVE_KEYS.has(normalizedKey)) {
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
