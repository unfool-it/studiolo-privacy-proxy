import express, { Request, Response, NextFunction, Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import axios, { AxiosError } from 'axios';

dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env['PORT'] || '3000', 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Type-safe Configuration
const TARGET_URL: string = process.env['TARGET_URL'] || '';
if (!TARGET_URL) {
    throw new Error("TARGET_URL is not defined in environment variables.");
}

// Strictly typed middleware
app.post('/proxy', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const response = await axios({
            method: req.method,
            url: `${TARGET_URL}${req.url}`,
            data: req.body,
            headers: {
                'Authorization': req.headers['authorization'] || '',
                'Content-Type': 'application/json'
            }
        });

        res.status(response.status).json(response.data);
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            res.status(axiosError.response?.status || 500).json(axiosError.response?.data || { error: 'Proxy Error' });
        } else {
            next(error);
        }
    }
});

// Error handling middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    console.error(err);
    res.status(500).send({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`[STRICT] Privacy Proxy active on port ${PORT}`);
});
