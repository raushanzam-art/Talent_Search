import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthenticatedRequest, createAuthenticateMiddleware, requireRoles } from '../auth/auth.middleware';
import { startAssessment } from './assessment.service';

const assessmentIdSchema = z.object({ assessmentId: z.string().uuid() });

export function createAssessmentRoutes(prisma: PrismaClient, jwtSecret: string): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(prisma, jwtSecret);
  const candidateOnly = [authenticate, requireRoles('CANDIDATE')];

  router.post('/:assessmentId/start', ...candidateOnly, async (request, response, next) => {
    try {
      const { assessmentId } = assessmentIdSchema.parse(request.params);
      const authenticatedRequest = request as AuthenticatedRequest;
      if (!authenticatedRequest.user) {
        response.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const result = await startAssessment(prisma, authenticatedRequest.user.id, assessmentId);
      response.status(201).json({ data: result });
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}
