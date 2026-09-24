import { Prisma, PrismaClient } from '@prisma/client';
import { CandidateQuestion } from '../../questions/questionService';

export class AssessmentNotFoundError extends Error {
  constructor(id: string) {
    super(`Assessment not found: ${id}`);
    this.name = 'AssessmentNotFoundError';
  }
}

export class AssessmentStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssessmentStartError';
  }
}

export interface StartedAssessment {
  attemptId: string;
  assessmentId: string;
  questionCount: number;
  question: CandidateQuestion;
  questionStartedAt: Date;
  allowedSeconds: number;
}

const candidateQuestionSelect = {
  id: true,
  questionCode: true,
  text: true,
  questionType: true,
  difficulty: true,
  language: true,
  explanation: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  skill: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, description: true, displayOrder: true, active: true } },
  expertiseLevel: { select: { id: true, name: true, secondsPerQuestion: true } },
  options: {
    select: { id: true, optionText: true },
    orderBy: { optionText: 'asc' as const }
  }
} satisfies Prisma.QuestionSelect;

type CandidateQuestionRecord = Prisma.QuestionGetPayload<{
  select: typeof candidateQuestionSelect;
}>;

function toCandidateQuestion(question: CandidateQuestionRecord): CandidateQuestion {
  return {
    id: question.id,
    questionCode: question.questionCode,
    text: question.text,
    skill: question.skill,
    expertiseLevel: question.expertiseLevel,
    type: question.questionType,
    category: question.category,
    difficulty: question.difficulty,
    language: question.language,
    ...(question.explanation === null ? {} : { explanation: question.explanation }),
    active: question.active,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    options: question.options
  };
}

function questionMaxScore(options: Array<{ score: number }>): number {
  return options.reduce((max, option) => Math.max(max, option.score), 0);
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

export function randomizeQuestionIds(questionIds: string[]): string[] {
  return shuffle(questionIds);
}

async function getFirstAttemptQuestion(
  prisma: PrismaClient,
  attemptId: string
): Promise<CandidateQuestionRecord> {
  const snapshot = await prisma.assessmentAttemptQuestion.findFirst({
    where: { attemptId, position: 0 },
    include: { question: { select: candidateQuestionSelect } }
  });
  if (!snapshot) {
    throw new AssessmentStartError('The existing assessment attempt has no questions.');
  }
  return snapshot.question;
}

export async function startAssessment(
  prisma: PrismaClient,
  userId: string,
  assessmentId: string
): Promise<StartedAssessment> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      questions: {
        where: { question: { active: true } },
        orderBy: { position: 'asc' },
        include: { question: { select: { id: true, expertiseLevelId: true, options: { select: { score: true } } } } }
      }
    }
  });

  if (!assessment || !assessment.active) {
    throw new AssessmentNotFoundError(assessmentId);
  }
  const assignment = await prisma.assessmentAssignment.findUnique({ where: { userId_assessmentId: { userId, assessmentId } } });
  if (!assignment || assignment.status !== 'ASSIGNED') {
    throw new AssessmentStartError('This assessment has not been assigned to this candidate.');
  }
  if (assessment.questionCount < 1) {
    throw new AssessmentStartError('Assessment must require at least one question.');
  }

  const existingAttempt = await prisma.assessmentAttempt.findFirst({
    where: { userId, assessmentId, status: 'IN_PROGRESS' },
    orderBy: { startedAt: 'desc' }
  });
  if (existingAttempt) {
    const firstSnapshot = await prisma.assessmentAttemptQuestion.findFirst({
      where: { attemptId: existingAttempt.id, position: 0 },
      include: { question: { select: { ...candidateQuestionSelect, expertiseLevel: { select: { id: true, name: true, secondsPerQuestion: true } } } } }
    });
    if (!firstSnapshot) {
      throw new AssessmentStartError('The existing assessment attempt has no questions.');
    }
    const questionStartedAt = firstSnapshot.questionStartedAt ?? existingAttempt.startedAt;
    if (!firstSnapshot.questionStartedAt) {
      await prisma.assessmentAttemptQuestion.update({
        where: { id: firstSnapshot.id },
        data: { questionStartedAt }
      });
    }
    return {
      attemptId: existingAttempt.id,
      assessmentId,
      questionCount: assessment.questionCount,
      question: toCandidateQuestion(firstSnapshot.question),
      questionStartedAt,
      allowedSeconds: firstSnapshot.question.expertiseLevel.secondsPerQuestion
    };
  }

  const eligibleQuestionIds = assessment.questions.map((configuredQuestion) => configuredQuestion.questionId);
  if (eligibleQuestionIds.length < assessment.questionCount) {
    throw new AssessmentStartError(
      `Assessment requires ${assessment.questionCount} active questions, but only ${eligibleQuestionIds.length} are configured.`
    );
  }

  const selectedQuestionIds = randomizeQuestionIds(eligibleQuestionIds).slice(0, assessment.questionCount);
  const maxScoreByQuestionId = new Map(assessment.questions.map((configured) => [configured.questionId, questionMaxScore(configured.question.options)]));
  const totalMaxScore = selectedQuestionIds.reduce((sum, questionId) => sum + (maxScoreByQuestionId.get(questionId) ?? 0), 0);
  const startedAt = new Date();
  const attempt = await prisma.$transaction(async (transaction) => {
    const createdAttempt = await transaction.assessmentAttempt.create({
      data: {
        userId,
        assessmentId,
        startedAt,
        maxScore: totalMaxScore,
        questions: {
          create: selectedQuestionIds.map((questionId, position) => ({
            questionId,
            position,
            ...(position === 0 ? { questionStartedAt: startedAt } : {})
          }))
        }
      }
    });
    return createdAttempt;
  });

  const firstQuestion = await getFirstAttemptQuestion(prisma, attempt.id);
  return {
    attemptId: attempt.id,
    assessmentId,
    questionCount: assessment.questionCount,
    question: toCandidateQuestion(firstQuestion),
    questionStartedAt: attempt.startedAt,
    allowedSeconds: firstQuestion.expertiseLevel.secondsPerQuestion
  };
}
