import { Prisma, PrismaClient } from '@prisma/client';
import { CandidateQuestion } from '../../questions/questionService';

export class AttemptNotFoundError extends Error {
  constructor() { super('Assessment attempt not found.'); this.name = 'AttemptNotFoundError'; }
}
export class AttemptQuestionError extends Error {
  constructor(message: string) { super(message); this.name = 'AttemptQuestionError'; }
}
export class DuplicateAnswerError extends Error {
  constructor() { super('This question has already been answered for this attempt.'); this.name = 'DuplicateAnswerError'; }
}
export class AttemptCompletedError extends Error {
  constructor() { super('This assessment attempt is already completed.'); this.name = 'AttemptCompletedError'; }
}

export interface AssessmentResult { score: number; maxScore: number; percentage: number; answeredCount: number; }
export interface AnswerSubmissionResult {
  attemptId: string;
  answeredQuestionId: string;
  nextQuestion: CandidateQuestion | null;
  nextQuestionStartedAt: Date | null;
  allowedSeconds: number | null;
  result: AssessmentResult;
}
export interface TimeoutResult {
  attemptId: string;
  questionId: string;
  nextQuestion: CandidateQuestion | null;
  nextQuestionStartedAt: Date | null;
  allowedSeconds: number | null;
  result: AssessmentResult;
}
export class QuestionTimedOutError extends Error {
  constructor(public readonly timeout: TimeoutResult) { super('The allowed time for this question has expired.'); this.name = 'QuestionTimedOutError'; }
}

export function calculateElapsedSeconds(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
}

export function calculateAssessmentResult(score: number, maxScore: number, answeredCount: number): AssessmentResult {
  return { score, maxScore, percentage: maxScore === 0 ? 0 : (score / maxScore) * 100, answeredCount };
}

const candidateQuestionSelect = {
  id: true, questionCode: true, text: true, questionType: true, difficulty: true, language: true,
  explanation: true, active: true, createdAt: true, updatedAt: true,
  skill: { select: { id: true, name: true } },
  expertiseLevel: { select: { id: true, name: true, secondsPerQuestion: true } },
  options: { select: { id: true, optionText: true }, orderBy: { optionText: 'asc' as const } }
} satisfies Prisma.QuestionSelect;

type CandidateQuestionRecord = Prisma.QuestionGetPayload<{ select: typeof candidateQuestionSelect }>;

function toCandidateQuestion(question: CandidateQuestionRecord): CandidateQuestion {
  return {
    id: question.id, questionCode: question.questionCode, text: question.text,
    skill: question.skill, expertiseLevel: question.expertiseLevel, type: question.questionType,
    difficulty: question.difficulty, language: question.language,
    ...(question.explanation === null ? {} : { explanation: question.explanation }),
    active: question.active, createdAt: question.createdAt, updatedAt: question.updatedAt,
    options: question.options
  };
}

async function getNextQuestion(transaction: Prisma.TransactionClient, attemptId: string, answeredQuestionIds: string[], now: Date) {
  const snapshot = await transaction.assessmentAttemptQuestion.findFirst({
    where: { attemptId, timedOut: false, questionId: { notIn: answeredQuestionIds } },
    orderBy: { position: 'asc' },
    include: { question: { select: candidateQuestionSelect } }
  });
  if (!snapshot) return { question: null, startedAt: null, allowedSeconds: null };
  const startedAt = snapshot.questionStartedAt ?? now;
  if (!snapshot.questionStartedAt) {
    await transaction.assessmentAttemptQuestion.update({ where: { id: snapshot.id }, data: { questionStartedAt: startedAt } });
  }
  return { question: toCandidateQuestion(snapshot.question), startedAt, allowedSeconds: snapshot.question.expertiseLevel.secondsPerQuestion };
}

export async function submitAnswer(
  prisma: PrismaClient, userId: string, attemptId: string, questionId: string, optionId: string, now = new Date()
): Promise<AnswerSubmissionResult> {
  return prisma.$transaction(async (transaction) => {
    const attempt = await transaction.assessmentAttempt.findUnique({ where: { id: attemptId }, select: { id: true, userId: true, status: true, maxScore: true } });
    if (!attempt || attempt.userId !== userId) throw new AttemptNotFoundError();
    if (attempt.status !== 'IN_PROGRESS') throw new AttemptCompletedError();

    const attemptQuestion = await transaction.assessmentAttemptQuestion.findFirst({
      where: { attemptId, questionId },
      include: { question: { select: { expertiseLevel: { select: { secondsPerQuestion: true } } } } }
    });
    if (!attemptQuestion) throw new AttemptQuestionError('Question does not belong to this assessment attempt.');

    const existingAnswer = await transaction.candidateAnswer.findFirst({ where: { attemptId, questionId }, select: { id: true } });
    if (existingAnswer || attemptQuestion.timedOut) throw new DuplicateAnswerError();
    if (!attemptQuestion.questionStartedAt) throw new AttemptQuestionError('Question timer has not started.');

    const elapsedSeconds = calculateElapsedSeconds(attemptQuestion.questionStartedAt, now);
    const allowedSeconds = attemptQuestion.question.expertiseLevel.secondsPerQuestion;
    const timedOut = now.getTime() - attemptQuestion.questionStartedAt.getTime() > allowedSeconds * 1000;

    if (!timedOut) {
      const option = await transaction.questionOption.findFirst({ where: { id: optionId, questionId }, select: { id: true, score: true } });
      if (!option) throw new AttemptQuestionError('Option does not belong to this question.');
      await transaction.candidateAnswer.create({ data: { attemptId, questionId, optionId: option.id, score: option.score, timeSpent: elapsedSeconds } });
    }

    await transaction.assessmentAttemptQuestion.update({ where: { id: attemptQuestion.id }, data: { timeSpent: elapsedSeconds, timedOut } });
    const [answeredCount, scoreAggregate, attemptQuestionCount, timedOutCount] = await Promise.all([
      transaction.candidateAnswer.count({ where: { attemptId } }),
      transaction.candidateAnswer.aggregate({ where: { attemptId }, _sum: { score: true } }),
      transaction.assessmentAttemptQuestion.count({ where: { attemptId } }),
      transaction.assessmentAttemptQuestion.count({ where: { attemptId, timedOut: true } })
    ]);
    const result = calculateAssessmentResult(scoreAggregate._sum.score ?? 0, attempt.maxScore, answeredCount);
    const completed = answeredCount + timedOutCount >= attemptQuestionCount;
    const answeredQuestions = await transaction.candidateAnswer.findMany({ where: { attemptId }, select: { questionId: true } });
    const next = completed
      ? { question: null, startedAt: null, allowedSeconds: null }
      : await getNextQuestion(transaction, attemptId, answeredQuestions.map((answer) => answer.questionId), now);

    await transaction.assessmentAttempt.update({
      where: { id: attemptId },
      data: { score: result.score, answeredCount, percentage: completed ? result.percentage : null, status: completed ? 'COMPLETED' : 'IN_PROGRESS', completedAt: completed ? now : null }
    });

    const response: AnswerSubmissionResult = {
      attemptId, answeredQuestionId: questionId, nextQuestion: next.question,
      nextQuestionStartedAt: next.startedAt, allowedSeconds: next.allowedSeconds, result
    };
    return { response, timedOut };
  }).then(({ response, timedOut }) => {
    if (timedOut) {
      throw new QuestionTimedOutError({
        attemptId: response.attemptId,
        questionId: response.answeredQuestionId,
        nextQuestion: response.nextQuestion,
        nextQuestionStartedAt: response.nextQuestionStartedAt,
        allowedSeconds: response.allowedSeconds,
        result: response.result
      });
    }
    return response;
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new DuplicateAnswerError();
    throw error;
  });
}
