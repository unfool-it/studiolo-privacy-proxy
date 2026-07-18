import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { ConfigLoader } from './config/index.js';
import { UtilityService } from './services/UtilityService.js';
import { StructuredLogger } from './utils/logger.js';
import { AppError } from './middleware/errorHandler.js';

const config = ConfigLoader.getInstance().getConfig();
const service = UtilityService.getInstance();
const MAX_PAYLOAD_SIZE = 1e6; // 1MB Guard

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  let body = '';
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json');

  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
    if (body.length > MAX_PAYLOAD_SIZE) {
      req.destroy(new Error('PAYLOAD_TOO_LARGE'));
    }
  });

  req.on('end', () => {
    try {
      if (req.url === '/metrics' && req.method === 'GET') {
        return res.end(JSON.stringify(service.getMetrics()));
      }

      if (req.url === '/ingest' && req.method === 'POST') {
        const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
        
        let parsed: unknown;
        try {
          parsed = body ? JSON.parse(body) : {};
        } catch {
          throw new AppError('MALFORMED_JSON', 'Payload must be valid JSON', 400);
        }

        const result = service.processRequest(ip, parsed);
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, ...result }));
      }

      throw new AppError('NOT_FOUND', 'Resource not found', 404);
    } catch (err: any) {
      const status = err instanceof AppError ? err.status : 500;
      const payload = err instanceof AppError ? err.toJSON() : { 
        error: true, 
        code: 'INTERNAL_FAULT', 
        message: 'Security boundary breach' 
      };

      StructuredLogger.log(status === 500 ? 'ERROR' : 'WARN', 'Request failure', { 
        code: payload.code,
        url: req.url 
      });

      if (!res.headersSent) res.writeHead(status);
      res.end(JSON.stringify(payload));
    }
  });
});

server.listen(config.port, () => {
  StructuredLogger.log('INFO', `Zenith Protocol: Studiolo Privacy Proxy active on port ${config.port}`);
});

// Graceful Degradation
process.on('SIGTERM', () => {
  StructuredLogger.log('WARN', 'Termination signal received. Closing boundary.');
  server.close(() => process.exit(0));
});
