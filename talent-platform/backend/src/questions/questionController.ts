import { RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import { questionIdSchema, questionInputSchema } from './questionSchemas';
import {
  createQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  updateQuestion
} from './questionService';

export function createQuestionController(prisma: PrismaClient): {
  list: RequestHandler;
  get: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
} {
  return {
    list: async (_request, response, next) => {
      try {
        response.status(200).json({ data: await listQuestions(prisma) });
      } catch (error: unknown) {
        next(error);
      }
    },
    get: async (request, response, next) => {
      try {
        const { id } = questionIdSchema.parse(request.params);
        response.status(200).json({ data: await getQuestion(prisma, id) });
      } catch (error: unknown) {
        next(error);
      }
    },
    create: async (request, response, next) => {
      try {
        const input = questionInputSchema.parse(request.body);
        response.status(201).json({ data: await createQuestion(prisma, input) });
      } catch (error: unknown) {
        next(error);
      }
    },
    update: async (request, response, next) => {
      try {
        const { id } = questionIdSchema.parse(request.params);
        const input = questionInputSchema.parse(request.body);
        response.status(200).json({ data: await updateQuestion(prisma, id, input) });
      } catch (error: unknown) {
        next(error);
      }
    },
    remove: async (request, response, next) => {
      try {
        const { id } = questionIdSchema.parse(request.params);
        await deleteQuestion(prisma, id);
        response.status(204).send();
      } catch (error: unknown) {
        next(error);
      }
    }
  };
}
