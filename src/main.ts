import { createServer, IncomingMessage, ServerResponse } from 'http';
import { ConfigLoader } from './config/index.js';
import { UtilityService } from './services/UtilityService.js';
import { StructuredLogger } from './utils/logger.js';
import { AppError } from './middleware/errorHandler.js';

const config = ConfigLoader.getInstance().getConfig();
const service = UtilityService.getInstance();

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
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
        const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
        
        let parsed;
        try {
          parsed = body ? JSON.parse(body) : {};
        } catch (e) {
          throw new AppError('MALFORMED_JSON', 'Invalid JSON payload received', 400);
        }

        const result = service.processRequest(ip, parsed);
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, ...result }));
      }

      throw new AppError('NOT_FOUND', 'The requested resource was not found', 404);
    } catch (err: any) {
      const status = err instanceof AppError ? err.status : 500;
      const payload = err instanceof AppError ? err.toJSON() : { 
        error: true, 
        code: 'INTERNAL_ERROR', 
        message: 'A critical runtime fault occurred' 
      };

      StructuredLogger.log('ERROR', 'Security boundary exception', { 
        error: payload,
        stack: status === 500 ? err.stack : undefined 
      });

      res.writeHead(status);
      res.end(JSON.stringify(payload));
    }
  });
});

server.listen(config.port, () => {
  StructuredLogger.log('INFO', `Sovereign Studiolo Proxy initialized on port ${config.port}`);
});
