import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, createAuthenticateMiddleware, requireRoles } from '../auth/auth.middleware';

export function createCandidateRoutes(prisma: PrismaClient, jwtSecret: string): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(prisma, jwtSecret);
  router.use(authenticate, requireRoles('CANDIDATE'));

  router.get('/assignments', async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user!;
      const assignments = await prisma.assessmentAssignment.findMany({ where: { userId: user.id, status: 'ASSIGNED' }, include: { assessment: { select: { id: true, name: true, questionCount: true } } }, orderBy: { assignedAt: 'desc' } });
      const data = await Promise.all(assignments.map(async (assignment) => {
        const attempt = await prisma.assessmentAttempt.findFirst({ where: { userId: user.id, assessmentId: assignment.assessmentId }, orderBy: { startedAt: 'desc' }, select: { id: true, status: true } });
        return { ...assignment, attempt };
      }));
      response.json({ data });
    } catch (error: unknown) { next(error); }
  });

  return router;
}
