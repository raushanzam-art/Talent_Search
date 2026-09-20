import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthController } from './auth.controller';
import { createAuthenticateMiddleware } from './auth.middleware';

export function createAuthRoutes(prisma: PrismaClient, jwtSecret: string): Router {
  const router = Router();
  const controller = createAuthController(prisma, jwtSecret);
  const authenticate = createAuthenticateMiddleware(prisma, jwtSecret);

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.get('/me', authenticate, controller.me);

  return router;
}
