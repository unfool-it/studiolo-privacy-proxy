import express, { Request, Response } from 'express';
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

app.use(helmet());
app.use(cors());
app.use(express.json());

/**
 * System Telemetry Interface
 */
app.get('/system/metrics', (_req: Request, res: Response) => {
    res.json(metrics.getSnapshot());
});

/**
 * Sovereign Ingestion Handler
 * Implements Identity Truncation and Recursive Redaction
 */
app.post('/v1/ingest', async (req: Request, res: Response) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const targetUrl = `${process.env.UPSTREAM_URL}/ingest`;

    try {
        // Phase 1: Privacy Transformation
        const { anonymizedId, payload } = utility.processRequest(
            ip, 
            req.body, 
            SALT, 
            16 // Mask bits for K-Anonymity
        );

        // Phase 2: Secure Forwarding
        const response = await proxy.forward(
            targetUrl,
            'POST',
            { ...req.headers, 'x-sovereign-id': anonymizedId },
            payload
        );

        res.status(200).json({
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
