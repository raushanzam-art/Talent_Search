import { Prisma, PrismaClient } from '@prisma/client';
import { QuestionInput } from './questionSchemas';

export class QuestionNotFoundError extends Error {
  constructor(id: string) {
    super(`Question not found: ${id}`);
    this.name = 'QuestionNotFoundError';
  }
}

export class QuestionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionConflictError';
  }
}

export class QuestionReferenceNotFoundError extends Error {
  constructor(reference: string, id: string) {
    super(`${reference} not found: ${id}`);
    this.name = 'QuestionReferenceNotFoundError';
  }
}

const questionInclude = {
  skill: { select: { id: true, name: true } },
  expertiseLevel: { select: { id: true, name: true, secondsPerQuestion: true } },
  category: { select: { id: true, name: true, description: true, displayOrder: true, active: true } },
  options: {
    select: {
      id: true,
      optionText: true,
      score: true,
      isCorrect: true
    },
    orderBy: { optionText: 'asc' as const }
  }
} satisfies Prisma.QuestionInclude;

type QuestionWithRelations = Prisma.QuestionGetPayload<{
  include: typeof questionInclude;
}>;

type PrismaDatabase = PrismaClient | Prisma.TransactionClient;

export interface CandidateQuestion {
  id: string;
  questionCode: string;
  text: string;
  skill: { id: string; name: string };
  expertiseLevel: { id: string; name: string; secondsPerQuestion: number };
  category: { id: string; name: string; description: string | null; displayOrder: number; active: boolean } | null;
  type: string;
  difficulty: string;
  language: string;
  explanation?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  options: Array<{ id: string; optionText: string }>;
}

export interface AdminQuestion extends CandidateQuestion {
  options: Array<{ id: string; optionText: string; score: number; isCorrect: boolean }>;
}

function toAdminQuestion(question: QuestionWithRelations): AdminQuestion {
  return {
    id: question.id,
    questionCode: question.questionCode,
    text: question.text,
    skill: question.skill,
    expertiseLevel: question.expertiseLevel,
    category: question.category,
    type: question.questionType,
    difficulty: question.difficulty,
    language: question.language,
    ...(question.explanation === null ? {} : { explanation: question.explanation }),
    active: question.active,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    options: question.options
  };
}

export function toCandidateQuestion(question: QuestionWithRelations): CandidateQuestion {
  const adminQuestion = toAdminQuestion(question);
  return {
    ...adminQuestion,
    options: adminQuestion.options.map(({ id, optionText }) => ({ id, optionText }))
  };
}

function questionData(input: QuestionInput): Prisma.QuestionCreateInput {
  return {
    questionCode: input.questionCode,
    text: input.text,
    questionType: input.type,
    difficulty: input.difficulty,
    language: input.language,
    explanation: input.explanation,
    active: input.active,
    skill: { connect: { id: input.skillId } },
    expertiseLevel: { connect: { id: input.expertiseLevelId } },
    ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
    options: {
      create: input.options
    }
  };
}

async function ensureReferences(prisma: PrismaDatabase, input: QuestionInput): Promise<void> {
  const [skill, expertiseLevel, questionType, category] = await Promise.all([
    prisma.skill.findUnique({ where: { id: input.skillId }, select: { id: true } }),
    prisma.expertiseLevel.findUnique({ where: { id: input.expertiseLevelId }, select: { id: true } }),
    prisma.questionType.findFirst({ where: { name: input.type, active: true }, select: { id: true } }),
    input.categoryId ? prisma.questionCategory.findFirst({ where: { id: input.categoryId, active: true }, select: { id: true } }) : Promise.resolve(null)
  ]);

  if (!skill) {
    throw new QuestionReferenceNotFoundError('Skill', input.skillId);
  }
  if (!expertiseLevel) {
    throw new QuestionReferenceNotFoundError('Expertise level', input.expertiseLevelId);
  }
  if (!questionType) {
    throw new QuestionReferenceNotFoundError('Question type', input.type);
  }
  if (input.categoryId && !category) {
    throw new QuestionReferenceNotFoundError('Question category', input.categoryId);
  }
}

async function findQuestionOrThrow(prisma: PrismaDatabase, id: string): Promise<QuestionWithRelations> {
  const question = await prisma.question.findUnique({
    where: { id },
    include: questionInclude
  });
  if (!question) {
    throw new QuestionNotFoundError(id);
  }
  return question;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function listQuestions(prisma: PrismaClient): Promise<AdminQuestion[]> {
  const questions = await prisma.question.findMany({
    include: questionInclude,
    orderBy: { createdAt: 'desc' }
  });
  return questions.map(toAdminQuestion);
}

export async function getQuestion(prisma: PrismaClient, id: string): Promise<AdminQuestion> {
  return toAdminQuestion(await findQuestionOrThrow(prisma, id));
}

export async function createQuestion(prisma: PrismaClient, input: QuestionInput): Promise<AdminQuestion> {
  try {
    await ensureReferences(prisma, input);
    const question = await prisma.question.create({
      data: questionData(input),
      include: questionInclude
    });
    return toAdminQuestion(question);
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw new QuestionConflictError(`Question code already exists: ${input.questionCode}`);
    }
    throw error;
  }
}

export async function updateQuestion(
  prisma: PrismaClient,
  id: string,
  input: QuestionInput
): Promise<AdminQuestion> {
  try {
    await ensureReferences(prisma, input);
    const question = await prisma.$transaction(async (transaction) => {
      await findQuestionOrThrow(transaction, id);
      await transaction.questionOption.deleteMany({ where: { questionId: id } });
      return transaction.question.update({
        where: { id },
        data: questionData(input),
        include: questionInclude
      });
    });
    return toAdminQuestion(question);
  } catch (error: unknown) {
    if (error instanceof QuestionNotFoundError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new QuestionConflictError(`Question code already exists: ${input.questionCode}`);
    }
    throw error;
  }
}

export async function deleteQuestion(prisma: PrismaClient, id: string): Promise<void> {
  await findQuestionOrThrow(prisma, id);
  await prisma.question.delete({ where: { id } });
}
