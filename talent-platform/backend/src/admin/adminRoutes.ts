import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import multer from 'multer';
import { createAuthenticateMiddleware, requireRoles } from '../modules/auth/auth.middleware';
import { importValidatedQuestions, validateQuestionsCsv } from '../imports/questionCsvImporter';

const idSchema = z.object({ id: z.string().uuid() });
const skillSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional(),
  active: z.boolean().default(true)
}).strict();
const expertiseLevelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  secondsPerQuestion: z.number().int().positive(),
  active: z.boolean().default(true)
}).strict();
const questionTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  active: z.boolean().default(true)
}).strict();
const questionCategorySchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional(),
  displayOrder: z.number().int().min(0),
  active: z.boolean().default(true)
}).strict();
const categoryRemovalSchema = z.object({ replacementCategoryId: z.string().trim().min(1).max(100).optional() }).strict();
const assessmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  questionIds: z.array(z.string().uuid()).min(1),
  active: z.boolean().default(true)
}).strict();
const assignmentSchema = z.object({ userId: z.string().uuid() }).strict();

export function createAdminRoutes(prisma: PrismaClient, jwtSecret: string): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(prisma, jwtSecret);
  const adminOnly = [authenticate, requireRoles('ADMIN')];
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

  router.get('/users', ...adminOnly, async (_request, response, next) => {
    try {
      response.json({ data: await prisma.user.findMany({ where: { role: 'CANDIDATE', active: true }, select: { id: true, email: true, firstName: true, lastName: true }, orderBy: { email: 'asc' } }) });
    } catch (error: unknown) { next(error); }
  });

  router.get('/assessments', ...adminOnly, async (_request, response, next) => {
    try {
      response.json({ data: await prisma.assessment.findMany({ include: { questions: { select: { questionId: true, position: true } }, assignments: { select: { id: true, userId: true, status: true, user: { select: { email: true, firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' } }) });
    } catch (error: unknown) { next(error); }
  });

  router.post('/assessments', ...adminOnly, async (request, response, next) => {
    try {
      const input = assessmentSchema.parse(request.body);
      const uniqueQuestionIds = [...new Set(input.questionIds)];
      const questions = await prisma.question.findMany({ where: { id: { in: uniqueQuestionIds }, active: true }, select: { id: true } });
      if (questions.length !== uniqueQuestionIds.length) { response.status(400).json({ error: 'All questionIds must reference active questions.' }); return; }
      const assessment = await prisma.assessment.create({ data: { name: input.name, questionCount: uniqueQuestionIds.length, active: input.active, questions: { create: uniqueQuestionIds.map((questionId, position) => ({ questionId, position })) } } });
      response.status(201).json({ data: assessment });
    } catch (error: unknown) { next(error); }
  });

  router.post('/assessments/:assessmentId/assign', ...adminOnly, async (request, response, next) => {
    try {
      const assessmentId = z.string().uuid().parse(request.params.assessmentId);
      const { userId } = assignmentSchema.parse(request.body);
      const user = await prisma.user.findFirst({ where: { id: userId, role: 'CANDIDATE', active: true } });
      const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
      if (!user || !assessment) { response.status(404).json({ error: 'Candidate or assessment not found.' }); return; }
      const assignment = await prisma.assessmentAssignment.upsert({ where: { userId_assessmentId: { userId, assessmentId } }, update: { status: 'ASSIGNED' }, create: { userId, assessmentId } });
      response.status(201).json({ data: assignment });
    } catch (error: unknown) { next(error); }
  });

  router.post('/questions/import', ...adminOnly, upload.single('file'), async (request, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({ error: 'CSV file is required in the file field.' });
        return;
      }
      const mode = z.enum(['validate', 'import']).default('validate').parse(request.query.mode);
      const validation = await validateQuestionsCsv(prisma, request.file.buffer.toString('utf8'));
      const report = mode === 'import' && validation.report.invalidRows === 0
        ? await importValidatedQuestions(prisma, validation)
        : validation.report;
      response.status(200).json({ data: { mode, ...report } });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/skills', ...adminOnly, async (_request, response, next) => {
    try {
      response.json({ data: await prisma.skill.findMany({ orderBy: { name: 'asc' } }) });
    } catch (error: unknown) {
      next(error);
    }
  });
  router.post('/skills', ...adminOnly, async (request, response, next) => {
    try {
      const input = skillSchema.parse(request.body);
      response.status(201).json({ data: await prisma.skill.create({ data: input }) });
    } catch (error: unknown) {
      next(error);
    }
  });
  router.put('/skills/:id', ...adminOnly, async (request, response, next) => {
    try {
      const { id } = idSchema.parse(request.params);
      const input = skillSchema.parse(request.body);
      response.json({ data: await prisma.skill.update({ where: { id }, data: input }) });
    } catch (error: unknown) {
      next(error);
    }
  });
  router.delete('/skills/:id', ...adminOnly, async (request, response, next) => {
    try {
      const { id } = idSchema.parse(request.params);
      await prisma.skill.delete({ where: { id } });
      response.status(204).send();
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/expertise-levels', ...adminOnly, async (_request, response, next) => {
    try {
      response.json({ data: await prisma.expertiseLevel.findMany({ orderBy: { secondsPerQuestion: 'desc' } }) });
    } catch (error: unknown) {
      next(error);
    }
  });
  router.post('/expertise-levels', ...adminOnly, async (request, response, next) => {
    try {
      const input = expertiseLevelSchema.parse(request.body);
      response.status(201).json({ data: await prisma.expertiseLevel.create({ data: input }) });
    } catch (error: unknown) {
      next(error);
    }
  });
  router.put('/expertise-levels/:id', ...adminOnly, async (request, response, next) => {
    try {
      const { id } = idSchema.parse(request.params);
      const input = expertiseLevelSchema.parse(request.body);
      response.json({ data: await prisma.expertiseLevel.update({ where: { id }, data: input }) });
    } catch (error: unknown) {
      next(error);
    }
  });
  router.delete('/expertise-levels/:id', ...adminOnly, async (request, response, next) => {
    try {
      const { id } = idSchema.parse(request.params);
      await prisma.expertiseLevel.delete({ where: { id } });
      response.status(204).send();
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get('/question-types', ...adminOnly, async (_request, response, next) => {
    try { response.json({ data: await prisma.questionType.findMany({ orderBy: { name: 'asc' } }) }); } catch (error: unknown) { next(error); }
  });
  router.post('/question-types', ...adminOnly, async (request, response, next) => {
    try { response.status(201).json({ data: await prisma.questionType.create({ data: questionTypeSchema.parse(request.body) }) }); } catch (error: unknown) { next(error); }
  });
  router.put('/question-types/:id', ...adminOnly, async (request, response, next) => {
    try {
      const { id } = idSchema.parse(request.params);
      const input = questionTypeSchema.parse(request.body);
      const existing = await prisma.questionType.findUnique({ where: { id } });
      if (!existing) { response.status(404).json({ error: 'Question type not found.' }); return; }
      const questionType = await prisma.$transaction(async (transaction) => {
        if (existing.name !== input.name) await transaction.question.updateMany({ where: { questionType: existing.name }, data: { questionType: input.name } });
        return transaction.questionType.update({ where: { id }, data: input });
      });
      response.json({ data: questionType });
    } catch (error: unknown) { next(error); }
  });
  router.delete('/question-types/:id', ...adminOnly, async (request, response, next) => {
    try {
      const { id } = idSchema.parse(request.params);
      const questionType = await prisma.questionType.findUnique({ where: { id } });
      if (!questionType) { response.status(404).json({ error: 'Question type not found.' }); return; }
      const questionCount = await prisma.question.count({ where: { questionType: questionType.name } });
      if (questionCount > 0) { response.status(409).json({ error: 'Question types in use cannot be deleted. Deactivate it instead.' }); return; }
      await prisma.questionType.delete({ where: { id } });
      response.status(204).send();
    } catch (error: unknown) { next(error); }
  });

  router.get('/question-categories', ...adminOnly, async (_request, response, next) => {
    try { response.json({ data: await prisma.questionCategory.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { questions: true } } } }) }); } catch (error: unknown) { next(error); }
  });
  router.post('/question-categories', ...adminOnly, async (request, response, next) => {
    try { response.status(201).json({ data: await prisma.questionCategory.create({ data: questionCategorySchema.parse(request.body) }) }); } catch (error: unknown) { next(error); }
  });
  router.put('/question-categories/:id', ...adminOnly, async (request, response, next) => {
    try { const { id } = idSchema.parse(request.params); response.json({ data: await prisma.questionCategory.update({ where: { id }, data: questionCategorySchema.parse(request.body) }) }); } catch (error: unknown) { next(error); }
  });
  router.delete('/question-categories/:id', ...adminOnly, async (request, response, next) => {
    try {
      const { id } = idSchema.parse(request.params); const { replacementCategoryId } = categoryRemovalSchema.parse(request.body ?? {});
      const category = await prisma.questionCategory.findUnique({ where: { id } });
      if (!category) { response.status(404).json({ error: 'Question category not found.' }); return; }
      const questionCount = await prisma.question.count({ where: { categoryId: id } });
      if (questionCount && !replacementCategoryId) { response.status(409).json({ error: `This category is assigned to ${questionCount} question${questionCount === 1 ? '' : 's'}. Choose a replacement category before removing it.`, details: { questionCount } }); return; }
      if (replacementCategoryId) {
        const replacement = await prisma.questionCategory.findFirst({ where: { id: replacementCategoryId, active: true } });
        if (!replacement || replacement.id === id) { response.status(400).json({ error: 'Choose a different active replacement category.' }); return; }
      }
      await prisma.$transaction(async (transaction) => { if (replacementCategoryId) await transaction.question.updateMany({ where: { categoryId: id }, data: { categoryId: replacementCategoryId } }); await transaction.questionCategory.delete({ where: { id } }); });
      response.status(204).send();
    } catch (error: unknown) { next(error); }
  });

  return router;
}
