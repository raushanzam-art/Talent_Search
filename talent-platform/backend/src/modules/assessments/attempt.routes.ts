import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthenticatedRequest, createAuthenticateMiddleware } from '../auth/auth.middleware';
import { submitAnswer } from './answer.service';
import { getCurrentAttempt } from './current.service';
import { getAssessmentResults } from './results.service';

const answerSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid()
}).strict();

export function createAttemptRoutes(prisma: PrismaClient, jwtSecret: string): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(prisma, jwtSecret);

  router.get('/:attemptId/results', authenticate, async (request, response, next) => {
    try {
      const attemptId = z.string().uuid().parse(request.params.attemptId);
      const authenticatedRequest = request as AuthenticatedRequest;
      if (!authenticatedRequest.user) {
        response.status(401).json({ error: 'Authentication required.' });
        return;
      }
      response.status(200).json({ data: await getAssessmentResults(prisma, authenticatedRequest.user, attemptId) });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/:attemptId/current', authenticate, async (request, response, next) => {
    try {
      const attemptId = z.string().uuid().parse(request.params.attemptId);
      const authenticatedRequest = request as AuthenticatedRequest;
      if (!authenticatedRequest.user) {
        response.status(401).json({ error: 'Authentication required.' });
        return;
      }
      response.status(200).json({ data: await getCurrentAttempt(prisma, authenticatedRequest.user.id, attemptId) });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/:attemptId/answers', authenticate, async (request, response, next) => {
    try {
      const attemptId = z.string().uuid().parse(request.params.attemptId);
      const { questionId, optionId } = answerSchema.parse(request.body);
      const authenticatedRequest = request as AuthenticatedRequest;
      if (!authenticatedRequest.user) {
        response.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const result = await submitAnswer(
        prisma,
        authenticatedRequest.user.id,
        attemptId,
        questionId,
        optionId
      );
      response.status(200).json({ data: result });
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}
