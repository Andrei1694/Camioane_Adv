import { Router } from 'express';
import { createFileController } from '../controllers/file.controller.ts';
import { authenticate } from '../middleware/authenticate.ts';
import { createUploadMiddleware } from '../middleware/upload.ts';
import { createFileService } from '../services/file.service.ts';
import type { FileStorageRegistry } from '../storage/file-storage.ts';

export function createFileRouter(storage: FileStorageRegistry, maxFileSize: number, ffprobePath: string) {
  const router = Router();
  const controller = createFileController(createFileService(storage, ffprobePath));
  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });
  router.use(authenticate);
  router.post('/', createUploadMiddleware(storage.uploadStorage, maxFileSize), controller.create);
  router.get('/', controller.list);
  router.get('/:id/download', controller.download);
  router.delete('/:id', controller.remove);
  return router;
}
