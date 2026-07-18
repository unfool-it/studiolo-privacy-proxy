import { createHmac } from 'crypto';

/**
 * PrivacyEngine: Executes cryptographic truncation and PII redaction.
 */
export class PrivacyEngine {
  private static readonly SENSITIVE_KEYS = new Set([
    'email', 'password', 'token', 'cookie', 'authorization', 'signature', 'sessiontoken'
  ]);
  
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Generates a deterministic, anonymized identifier for an IP address.
   * @param ip The raw IP address string.
   * @param salt The cryptographic secret.
   * @param maskBits Bit-depth for truncation.
   */
  public static hashIP(ip: string, salt: string, maskBits: number): string {
    const sanitized = ip.split(',')[0].trim();
    const hmac = createHmac('sha256', salt).update(sanitized).digest('hex');
    
    // Convert hex characters to represent bit truncation properly
    // 16 bits = 4 hex chars, 24 bits = 6 hex chars
    const hexChars = Math.floor(maskBits / 4);
    return `${hmac.substring(0, hexChars)}::[MASKED]`;
  }

  /**
   * Recursively scrubs sensitive data from JSON payloads.
   */
  public static scrubPayload(payload: any, seen = new WeakSet()): any {
    if (payload === null || typeof payload !== 'object') return payload;
    if (seen.has(payload)) return '[Circular]';
    seen.add(payload);

    const scrubbed: Record<string, any> = Array.isArray(payload) ? [] : {};
    
    for (const [key, val] of Object.entries(payload)) {
      if (this.SENSITIVE_KEYS.has(key.toLowerCase())) {
        scrubbed[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        scrubbed[key] = this.scrubPayload(val, seen);
      } else if (typeof val === 'string' && this.EMAIL_REGEX.test(val)) {
        scrubbed[key] = '[EMAIL_REDACTED]';
      } else {
        scrubbed[key] = val;
      }
    }
    return scrubbed;
  }
}
