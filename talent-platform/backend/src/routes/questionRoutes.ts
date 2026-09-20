import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createQuestionController } from '../questions/questionController';

export function createQuestionRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const controller = createQuestionController(prisma);

  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
