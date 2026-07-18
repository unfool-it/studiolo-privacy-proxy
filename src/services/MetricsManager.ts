import { EventEmitter } from 'events';

/**
 * MetricsManager: Implements 8-byte aligned SharedArrayBuffer 
 * for atomic cross-context telemetry.
 */
export class MetricsManager extends EventEmitter {
    private static instance: MetricsManager;
    private buffer: SharedArrayBuffer;
    private uint64View: BigUint64Array;

    // Offsets for 8-byte alignment
    private readonly OFFSETS = {
        TOTAL_REQUESTS: 0,
        BYTES_IN: 1,
        BYTES_OUT: 2,
        ERRORS: 3
    };

    private constructor() {
        super();
        // Allocate 64 bytes (8 slots of 8 bytes) to ensure future-proofing and alignment
        this.buffer = new SharedArrayBuffer(64);
        this.uint64View = new BigUint64Array(this.buffer);
    }

    public static getInstance(): MetricsManager {
        if (!MetricsManager.instance) {
            MetricsManager.instance = new MetricsManager();
        }
        return MetricsManager.instance;
    }

    public incrementRequests(): void {
        Atomics.add(this.uint64View, this.OFFSETS.TOTAL_REQUESTS, 1n);
    }

    public recordBytesIn(bytes: number): void {
        Atomics.add(this.uint64View, this.OFFSETS.BYTES_IN, BigInt(bytes));
    }

    public recordBytesOut(bytes: number): void {
        Atomics.add(this.uint64View, this.OFFSETS.BYTES_OUT, BigInt(bytes));
    }

    public incrementErrors(): void {
        Atomics.add(this.uint64View, this.OFFSETS.ERRORS, 1n);
    }

    public getSnapshot() {
        return {
            totalRequests: this.uint64View[this.OFFSETS.TOTAL_REQUESTS].toString(),
            bytesIn: this.uint64View[this.OFFSETS.BYTES_IN].toString(),
            bytesOut: this.uint64View[this.OFFSETS.BYTES_OUT].toString(),
            errors: this.uint64View[this.OFFSETS.ERRORS].toString(),
            timestamp: Date.now()
        };
    }
}
