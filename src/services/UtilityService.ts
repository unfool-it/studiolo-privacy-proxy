import { PrivacyEngine } from '../utils/security.js';
import { ConfigLoader } from '../config/index.js';

/**
 * UtilityService: Manages high-performance telemetry and processing.
 */
export class UtilityService {
  private static instance: UtilityService;
  private telemetryBuffer: SharedArrayBuffer;
  private countView: Int32Array;
  private bytesView: BigUint64Array;

  private constructor() {
    // Allocation: 0-3: Requests (Int32), 8-15: Bytes (BigUint64)
    this.telemetryBuffer = new SharedArrayBuffer(64);
    this.countView = new Int32Array(this.telemetryBuffer, 0, 1);
    this.bytesView = new BigUint64Array(this.telemetryBuffer, 8, 1);
  }

  public static getInstance(): UtilityService {
    if (!UtilityService.instance) {
      UtilityService.instance = new UtilityService();
    }
    return UtilityService.instance;
  }

  public processRequest(ip: string, payload: any): { anonymizedId: string; payload: any } {
    const config = ConfigLoader.getInstance().getConfig();
    const anonymizedId = PrivacyEngine.hashIP(ip, config.salt, config.maskBits);
    const scrubbed = PrivacyEngine.scrubPayload(payload);

    const payloadLength = BigInt(JSON.stringify(scrubbed).length);
    
    // Atomic operations prevent race conditions in high-concurrency environments
    Atomics.add(this.countView, 0, 1);
    Atomics.add(this.bytesView, 0, payloadLength);

    return { anonymizedId, payload: scrubbed };
  }

  public getMetrics() {
    return {
      requestCount: Atomics.load(this.countView, 0),
      totalBytesScrubbed: Atomics.load(this.bytesView, 0).toString()
    };
  }
}
