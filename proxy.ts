// ==================== FILE: src/config/index.ts ====================
import { env } from 'process';

export interface Config {
  port: number;
  salt: string;
  maskBits: number;
}

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: Config;

  private constructor() {
    const rawPort = env.PORT || '8080';
    const port = parseInt(rawPort, 10);
    if (isNaN(port)) throw new Error('Invalid system configuration: PORT must be numeric');
    const salt = env.SALT_KEY || 'default-cryptographic-studiolo-salt';
    const maskBits = parseInt(env.IP_MASK_BITS || '16', 10);
    this.config = Object.freeze({ port, salt, maskBits });
  }

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    } 
    return ConfigLoader.instance;
  }

  public getConfig(): Config {
    return this.config;
  }
}

// ==================== FILE: src/middleware/errorHandler.ts ====================
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.message
    };
  }
}

// ==================== FILE: src/utils/logger.ts ====================
export class StructuredLogger {
  public static log(level: 'INFO' | 'ERROR' | 'WARN', message: string, meta: Record<string, any> = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    };
    console.log(JSON.stringify(payload));
  }
}

// ==================== FILE: src/utils/security.ts ====================
import { createHmac } from 'crypto';

export class PrivacyEngine {
  private static readonly SENSITIVE_KEYS = new Set(['email', 'password', 'token', 'cookie', 'authorization', 'signature', 'sessiontoken']);
  private static readonly EMAIL_REGEX = /^[\w!#$%&'*+/=?^`{|}~-]+(?:\.[\w!#$%&'*+/=?^`{|}~-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;

  public static hashIP(ip: string, salt: string, maskBits: number): string {
    const sanitized = ip.split(',')[0].trim();
    const hmac = createHmac('sha256', salt).update(sanitized).digest('hex');
    return maskBits === 16 ? `${hmac.substring(0, 16)}::0.0` : `${hmac.substring(0, 24)}::0.0.0`;
  }

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

// ==================== FILE: src/services/UtilityService.ts ====================
import { PrivacyEngine } from '../utils/security.js';
import { ConfigLoader } from '../config/index.js';

const BYTES_PROCESSED_INDEX = 1;

export class UtilityService {
  private static instance: UtilityService;
  private telemetryBuffer: SharedArrayBuffer;
  private telemetryArray: Float64Array;

  private constructor() {
    this.telemetryBuffer = new SharedArrayBuffer(1024);
    this.telemetryArray = new Float64Array(this.telemetryBuffer, 0, 128);
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

    const trackingView = new Int32Array(this.telemetryBuffer, 256, 16);
    Atomics.add(trackingView, 0, 1);
    this.telemetryArray[BYTES_PROCESSED_INDEX] += JSON.stringify(scrubbed).length;

    return { anonymizedId, payload: scrubbed };
  }

  public getMetrics() {
    const trackingView = new Int32Array(this.telemetryBuffer, 256, 16);
    return {
      requestCount: Atomics.load(trackingView, 0),
      totalBytesScrubbed: this.telemetryArray[BYTES_PROCESSED_INDEX]
    };
  }
}

// ==================== FILE: src/main.ts ====================
import { createServer } from 'http';
import { ConfigLoader } from './config/index.js';
import { UtilityService } from './services/UtilityService.js';
import { StructuredLogger } from './utils/logger.js';
import { AppError } from './middleware/errorHandler.js';

const config = ConfigLoader.getInstance().getConfig();
const service = UtilityService.getInstance();

const server = createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/metrics' && req.method === 'GET') {
        res.writeHead(200);
        return res.end(JSON.stringify(service.getMetrics()));
      }
      if (req.url === '/ingest' && req.method === 'POST') {
        const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';
        const parsed = body ? JSON.parse(body) : {};
        const result = service.processRequest(ip, parsed);
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, ...result }));
      }
      throw new AppError('NOT_FOUND', 'The requested resource was not found', 404);
    } catch (err: any) {
      const status = err instanceof AppError ? err.status : 500;
      const payload = err instanceof AppError ? err.toJSON() : { error: true, code: 'INTERNAL_ERROR', message: err.message };
      StructuredLogger.log('ERROR', 'Sovereign security runtime fault', { error: payload });
      res.writeHead(status);
      res.end(JSON.stringify(payload));
    }
  });
});

server.listen(config.port, () => {
  StructuredLogger.log('INFO', `Privacy-by-Design Studiolo Ingestion Server online on port ${config.port}`);
});

const shutdown = () => {
  StructuredLogger.log('WARN', 'System shutdown sequence triggered. Disengaging gracefully.');
  server.close(() => { process.exit(0); });
}
