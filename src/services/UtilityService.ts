import { PrivacyEngine } from '../utils/security.js';
import { MetricsManager } from './MetricsManager.js';

export interface ProcessedResult {
  anonymizedId: string;
  payload: any;
}

/**
 * UtilityService: Orchestrates the PrivacyEngine within the request lifecycle.
 */
export class UtilityService {
  private static instance: UtilityService;
  private metrics = MetricsManager.getInstance();

  private constructor() {}

  public static getInstance(): UtilityService {
    if (!UtilityService.instance) {
      UtilityService.instance = new UtilityService();
    }
    return UtilityService.instance;
  }

  /**
   * Transforms raw ingress into sanitized egress.
   */
  public processRequest(ip: string, payload: any, salt: string, mask: number): ProcessedResult {
    const anonymizedId = PrivacyEngine.hashIP(ip, salt, mask);
    const scrubbed = PrivacyEngine.scrubPayload(payload);

    // Synchronize telemetry with MetricsManager
    const payloadSize = Buffer.byteLength(JSON.stringify(scrubbed));
    this.metrics.recordBytesIn(payloadSize);

    return { anonymizedId, payload: scrubbed };
  }
}
