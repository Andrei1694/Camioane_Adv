import { json, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { create, list, login, me, remove, update } from '../controllers/user.controller.ts';
import { authenticate, requireAdmin } from '../middleware/authenticate.ts';

export function createUserRouter() {
  const router = Router();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication requests. Try again later.' },
  });
  const parseJson = json({ limit: '16kb' });

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/login', authLimiter, parseJson, login);
  router.get('/me', authenticate, me);
  router.get('/', authenticate, requireAdmin, list);
  router.post('/', authenticate, requireAdmin, parseJson, create);
  router.patch('/:id', authenticate, requireAdmin, parseJson, update);
  router.delete('/:id', authenticate, requireAdmin, remove);

  return router;
}
