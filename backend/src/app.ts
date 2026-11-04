import cors from 'cors';
import express from 'express';
import { authConfig } from './config/auth.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { createUserRouter } from './routes/user.routes.ts';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({
    origin: authConfig.frontendOrigin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.get('/', (req, res) => {
    res.json({ message: 'Camioane API' });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/users', createUserRouter());

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use(errorHandler);

  return app;
}

export default createApp();
