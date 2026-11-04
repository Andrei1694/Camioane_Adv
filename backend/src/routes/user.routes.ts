import { json, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { login, me, register } from '../controllers/user.controller.ts';
import { authenticate } from '../middleware/authenticate.ts';

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

  router.post('/register', authLimiter, parseJson, register);
  router.post('/login', authLimiter, parseJson, login);
  router.get('/me', authenticate, me);

  return router;
}
