import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler';
import { createQuestionRoutes } from './routes/questionRoutes';
import { createAuthRoutes } from './modules/auth/auth.routes';
import { createAdminRoutes } from './admin/adminRoutes';
import { createAuthenticateMiddleware, requireRoles } from './modules/auth/auth.middleware';
import { createAssessmentRoutes } from './modules/assessments/assessment.routes';
import { createAttemptRoutes } from './modules/assessments/attempt.routes';
import { createCandidateRoutes } from './modules/candidate/candidate.routes';

export function createApp(prisma: PrismaClient, jwtSecret: string): express.Express {
  const app = express();

  app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/v1/auth', createAuthRoutes(prisma, jwtSecret));
  app.use('/api/v1/candidate', createCandidateRoutes(prisma, jwtSecret));
  app.use('/api/v1/assessments', createAssessmentRoutes(prisma, jwtSecret));
  app.use('/api/v1/attempts', createAttemptRoutes(prisma, jwtSecret));
  app.use('/api/v1/admin', createAdminRoutes(prisma, jwtSecret));
  app.use(
    '/api/v1/questions',
    createAuthenticateMiddleware(prisma, jwtSecret),
    requireRoles('ADMIN'),
    createQuestionRoutes(prisma)
  );
  app.use(errorHandler);

  return app;
}
