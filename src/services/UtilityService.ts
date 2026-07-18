import { PrivacyEngine } from '../utils/security.js';

export interface ProcessedResult {
  anonymizedId: string;
  payload: any;
}

export class UtilityService {
  private static instance: UtilityService;
  private readonly telemetryBuffer: SharedArrayBuffer;
  private readonly countView: Int32Array;
  private readonly bytesView: BigUint64Array;

  private constructor() {
    // 64-byte allocation for atomic metrics
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

  public processRequest(ip: string, payload: any, salt: string, mask: number): ProcessedResult {
    const anonymizedId = PrivacyEngine.hashIP(ip, salt, mask);
    const scrubbed = PrivacyEngine.scrubPayload(payload);

    // Update Telemetry
    Atomics.add(this.countView, 0, 1);
    const payloadSize = BigInt(Buffer.byteLength(JSON.stringify(scrubbed)));
    Atomics.add(this.bytesView, 0, payloadSize);

    return { anonymizedId, payload: scrubbed };
  }

  public getMetrics() {
    return {
      requestCount: Atomics.load(this.countView, 0),
      totalBytesScrubbed: Atomics.load(this.bytesView, 0).toString()
    };
  }
}
