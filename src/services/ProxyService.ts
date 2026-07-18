import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { MetricsManager } from './MetricsManager';

/**
 * ProxyService: Handles resilient upstream requests with connection pooling.
 */
export class ProxyService {
    private client: AxiosInstance;
    private metrics = MetricsManager.getInstance();

    constructor() {
        const agentOptions = {
            keepAlive: true,
            maxSockets: 100,
            maxFreeSockets: 10,
            timeout: 60000,
        };

        this.client = axios.create({
            httpAgent: new http.Agent(agentOptions),
            httpsAgent: new https.Agent(agentOptions),
            validateStatus: () => true, // Handle all status codes at proxy level
            responseType: 'arraybuffer'
        });
    }

    async forward(targetUrl: string, method: string, headers: any, data?: any) {
        this.metrics.incrementRequests();
        
        try {
            const start = Date.now();
            if (data) this.metrics.recordBytesIn(JSON.stringify(data).length);

            const response = await this.client({
                url: targetUrl,
                method,
                headers,
                data
            });

            this.metrics.recordBytesOut(response.data.byteLength);
            return response;
        } catch (error) {
            this.metrics.incrementErrors();
            throw error;
        }
    }
}
