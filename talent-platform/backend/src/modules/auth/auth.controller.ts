import { RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from './auth.middleware';
import { loginUser, registerUser } from './auth.service';
import { loginSchema, registerSchema } from './auth.validation';

export function createAuthController(prisma: PrismaClient, jwtSecret: string): {
  register: RequestHandler;
  login: RequestHandler;
  me: RequestHandler;
} {
  return {
    register: async (request, response, next) => {
      try {
        const input = registerSchema.parse(request.body);
        const result = await registerUser(prisma, jwtSecret, input);
        response.status(201).json(result);
      } catch (error: unknown) {
        next(error);
      }
    },
    login: async (request, response, next) => {
      try {
        const input = loginSchema.parse(request.body);
        const result = await loginUser(prisma, jwtSecret, input);
        response.status(200).json(result);
      } catch (error: unknown) {
        next(error);
      }
    },
    me: async (request, response, next) => {
      try {
        const authenticatedRequest = request as AuthenticatedRequest;
        if (!authenticatedRequest.user) {
          response.status(401).json({ error: 'Authentication required.' });
          return;
        }
        response.status(200).json({ user: authenticatedRequest.user });
      } catch (error: unknown) {
        next(error);
      }
    }
  };
}
