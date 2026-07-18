/**
 * FILE: src/main.ts
 * Sovereign Ingestion Handler with Environment Validation.
 */
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { ProxyService } from './services/ProxyService.js';
import { UtilityService } from './services/UtilityService.js';
import { MetricsManager } from './services/MetricsManager.js';

dotenv.config();

const app = express();
const proxy = new ProxyService();
const utility = UtilityService.getInstance();
const metrics = MetricsManager.getInstance();

const PORT = process.env.PORT || 3000;
const SALT = process.env.CRYPTO_SALT || 'default_sovereign_salt_32_chars';
const UPSTREAM_URL = process.env.UPSTREAM_URL;

if (!UPSTREAM_URL) {
    console.error('[CRITICAL] UPSTREAM_URL is not defined. Terminating.');
    process.exit(1);
}

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(express.json({ limit: '1mb' }));

app.get('/system/metrics', (_req: Request, res: Response) => {
    res.json(metrics.getSnapshot());
});

app.post('/v1/ingest', async (req: Request, res: Response) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const targetUrl = `${UPSTREAM_URL}/ingest`;

    try {
        const { anonymizedId, payload } = utility.processRequest(ip, req.body, SALT, 16);

        const response = await proxy.forward(
            targetUrl,
            'POST',
            { 'x-sovereign-id': anonymizedId },
            payload
        );

        res.status(response.status).json({
            status: 'sanitized',
            id: anonymizedId,
            payload: payload
        });
    } catch (error: any) {
        metrics.incrementErrors();
        res.status(502).json({ 
            error: 'Upstream Isolation Failure', 
            detail: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`[ZENITH] Magister Proxy Operational on Port ${PORT}`);
});
