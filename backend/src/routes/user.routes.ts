import { json, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createAvatarController } from '../controllers/avatar.controller.ts';
import { create, createRemoveUser, list, login, me, update } from '../controllers/user.controller.ts';
import { avatarMaxUploadBytes, renderAvatar } from '../lib/avatar-image.ts';
import { imageUploadTypes } from '../lib/file-validation.ts';
import { authenticate, requireAdmin, requireSelfOrAdmin } from '../middleware/authenticate.ts';
import { createUploadMiddleware } from '../middleware/upload.ts';
import { createAvatarService } from '../services/avatar.service.ts';
import type { FileStorageRegistry } from '../storage/file-storage.ts';

export function createUserRouter(storage: FileStorageRegistry) {
  const router = Router();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication requests. Try again later.' },
  });
  const parseJson = json({ limit: '16kb' });
  const avatars = createAvatarService(storage);
  const avatar = createAvatarController(avatars);
  const parseAvatar = createUploadMiddleware(storage.uploadStorage, avatarMaxUploadBytes, {
    accept: imageUploadTypes,
    transform: renderAvatar,
  });

  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });

  router.post('/login', authLimiter, parseJson, login);
  router.get('/me', authenticate, me);
  router.get('/', authenticate, requireAdmin, list);
  router.post('/', authenticate, requireAdmin, parseJson, create);
  router.patch('/:id', authenticate, requireAdmin, parseJson, update);
  router.delete('/:id', authenticate, requireAdmin, createRemoveUser(avatars));
  router.get('/:id/avatar', authenticate, requireSelfOrAdmin, avatar.download);
  router.put('/:id/avatar', authenticate, requireSelfOrAdmin, parseAvatar, avatar.upload);
  router.delete('/:id/avatar', authenticate, requireSelfOrAdmin, avatar.remove);

  return router;
}
