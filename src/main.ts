import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { ProxyService } from './services/ProxyService';
import { MetricsManager } from './services/MetricsManager';
import { applySecurityHeaders } from './utils/security';

dotenv.config();

const app = express();
const proxy = new ProxyService();
const metrics = MetricsManager.getInstance();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Metrics Endpoint
app.get('/system/metrics', (req, res) => {
    res.json(metrics.getSnapshot());
});

// Primary Proxy Handler
app.all('/v1/*', async (req, res) => {
    const targetPath = req.params[0];
    const targetUrl = `${process.env.UPSTREAM_URL}/${targetPath}`;

    try {
        const response = await proxy.forward(
            targetUrl,
            req.method,
            req.headers,
            req.body
        );

        // Strip sensitive upstream headers
        const safeHeaders = { ...response.headers };
        delete safeHeaders['content-encoding'];
        delete safeHeaders['transfer-encoding'];

        res.status(response.status).set(safeHeaders).send(response.data);
    } catch (error: any) {
        res.status(502).json({ error: 'Upstream Unreachable', detail: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Magister Proxy Operational on Port ${PORT}`);
});
