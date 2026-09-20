import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AuthUser, getUserById, verifyToken } from './auth.service';
import { UserRole } from './auth.validation';
import { PrismaClient } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function createAuthenticateMiddleware(prisma: PrismaClient, jwtSecret: string): RequestHandler {
  return async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    try {
      const authorization = request.header('authorization');
      if (!authorization?.startsWith('Bearer ')) {
        response.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const token = authorization.slice('Bearer '.length).trim();
      const claims = verifyToken(token, jwtSecret);
      request.user = await getUserById(prisma, claims.sub);
      next();
    } catch (_error: unknown) {
      response.status(401).json({ error: 'Invalid or expired authentication token.' });
    }
  };
}

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    if (!request.user) {
      response.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(request.user.role)) {
      response.status(403).json({ error: 'Insufficient permissions.' });
      return;
    }
    next();
  };
}
