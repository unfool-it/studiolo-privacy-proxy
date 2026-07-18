import axios, { AxiosInstance, AxiosResponse } from 'axios';
import http from 'node:http';
import https from 'node:https';
import { MetricsManager } from './MetricsManager.js';

export class ProxyService {
  private readonly client: AxiosInstance;
  private readonly metrics: MetricsManager = MetricsManager.getInstance();

  constructor() {
    this.client = axios.create({
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 150 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 150 }),
      timeout: 5000,
      validateStatus: (status) => status < 500
    });
  }

  public async forward(url: string, method: string, headers: Record<string, string>, data: unknown): Promise<AxiosResponse> {
    const startTime: number = Date.now();
    this.metrics.incrementRequests();

    try {
      const response = await this.client({
        url,
        method,
        headers: { ...headers, 'x-proxy-agent': 'Zenith-Magister' },
        data
      });

      if (response.data) {
        this.metrics.recordBytesOut(Buffer.byteLength(JSON.stringify(response.data)));
      }
      
      return response;
    } catch (error) {
      this.metrics.incrementErrors();
      throw new Error(`Upstream Connection Failure: ${(error as Error).message}`);
    }
  }
}
