import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import axios from 'axios';
import { UtilityService } from './services/UtilityService.js';
import { StructuredLogger } from './utils/logger.js';

const app = express();
const service = UtilityService.getInstance();

// Configuration Isolation
const PORT = parseInt(process.env['PORT'] || '8080', 10);
const SALT = process.env['SALT_KEY'] || 'default_studiolo_salt';
const TARGET_URL = process.env['TARGET_URL'];
const MASK_BITS = parseInt(process.env['IP_MASK_BITS'] || '16', 10);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/**
 * Primary Ingestion & Proxy Logic
 * Ensures no PII leaves the trust boundary.
 */
app.post('/v1/ingest', async (req: Request, res: Response): Promise<void> => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    
    // 1. Scrub and Anonymize
    const { anonymizedId, payload } = service.processRequest(ip, req.body, SALT, MASK_BITS);

    // 2. If TARGET_URL exists, forward the sanitized data
    if (TARGET_URL) {
      await axios.post(TARGET_URL, {
        source_id: anonymizedId,
        data: payload,
        timestamp: new Date().toISOString()
      }, {
        headers: { 'X-Privacy-Proxy': 'Sovereign-v1' },
        timeout: 5000
      });
    }

    res.status(200).json({
      status: 'sanitized',
      id: anonymizedId,
      processed: true
    });
  } catch (error: any) {
    StructuredLogger.log('ERROR', 'Ingestion Fault', { message: error.message });
    res.status(500).json({ error: 'Internal Security Runtime Fault' });
  }
});

app.get('/metrics', (_req, res) => {
  res.json(service.getMetrics());
});

app.listen(PORT, () => {
  StructuredLogger.log('INFO', `Sovereign Studiolo Proxy active on port ${PORT}`);
});
