import cors from 'cors';
import express from 'express';
import { authConfig } from './config/auth.ts';
import { loadCreditConfig } from './config/credits.ts';
import { createFileStorage, loadFileConfig } from './config/files.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { createCreditRouter } from './routes/credit.routes.ts';
import { createFileRouter } from './routes/file.routes.ts';
import { createUserRouter } from './routes/user.routes.ts';
import type { FileStorageRegistry } from './storage/file-storage.ts';

export function createApp(options: { fileStorage?: FileStorageRegistry; uploadMaxFileSizeBytes?: number } = {}) {
  const app = express();
  const fileConfig = loadFileConfig();
  const fileStorage = options.fileStorage ?? createFileStorage(fileConfig);

  app.disable('x-powered-by');
  app.use(cors({
    // The admin app and the public website; any other origin gets no CORS headers.
    origin: [authConfig.frontendOrigin, authConfig.websiteOrigin],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.get('/', (req, res) => {
    res.json({ message: 'Camioane API' });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/users', createUserRouter(fileStorage));
  app.use('/files', createFileRouter(
    fileStorage,
    options.uploadMaxFileSizeBytes ?? fileConfig.maxFileSize,
    fileConfig.ffprobePath,
  ));
  app.use('/credits', createCreditRouter(loadCreditConfig()));

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use(errorHandler);

  return app;
}

export default createApp();
