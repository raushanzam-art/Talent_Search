import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthenticatedRequest, createAuthenticateMiddleware } from '../auth/auth.middleware';
import { submitAnswer } from './answer.service';
import { getCurrentAttempt } from './current.service';
import { getAssessmentResults } from './results.service';
import { getAttemptAnswerDetails } from './attemptDetail.service';

const answerSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid().optional()
}).strict();

const attemptAnswersQuerySchema = z.object({
  status: z.enum(['correct', 'incorrect', 'timedOut', 'unanswered']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
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

  router.get('/:attemptId/answers', authenticate, async (request, response, next) => {
    try {
      const attemptId = z.string().uuid().parse(request.params.attemptId);
      const query = attemptAnswersQuerySchema.parse(request.query);
      const authenticatedRequest = request as AuthenticatedRequest;
      if (!authenticatedRequest.user) {
        response.status(401).json({ error: 'Authentication required.' });
        return;
      }
      response.status(200).json({ data: await getAttemptAnswerDetails(prisma, authenticatedRequest.user, attemptId, query) });
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
