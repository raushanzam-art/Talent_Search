import { Prisma, PrismaClient } from '@prisma/client';
import { CandidateQuestion } from '../../questions/questionService';
import { AttemptNotFoundError } from './answer.service';

export interface CurrentAttempt {
  attemptId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  questionNumber: number | null;
  totalQuestions: number;
  question: CandidateQuestion | null;
  questionStartedAt: Date | null;
  allowedSeconds: number | null;
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

export async function getCurrentAttempt(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  now = new Date()
): Promise<CurrentAttempt> {
  return prisma.$transaction(async (transaction) => {
    const attempt = await transaction.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, userId: true, status: true, score: true, maxScore: true, answeredCount: true }
    });
    if (!attempt || attempt.userId !== userId) throw new AttemptNotFoundError();

    const totalQuestions = await transaction.assessmentAttemptQuestion.count({ where: { attemptId } });
    if (attempt.status === 'COMPLETED') {
      return { attemptId, status: 'COMPLETED', questionNumber: null, totalQuestions, question: null, questionStartedAt: null, allowedSeconds: null };
    }

    for (;;) {
      const answered = await transaction.candidateAnswer.findMany({ where: { attemptId }, select: { questionId: true } });
      const snapshot = await transaction.assessmentAttemptQuestion.findFirst({
        where: { attemptId, timedOut: false, questionId: { notIn: answered.map((answer) => answer.questionId) } },
        orderBy: { position: 'asc' },
        include: { question: { select: candidateQuestionSelect } }
      });

      if (!snapshot) {
        await transaction.assessmentAttempt.update({
          where: { id: attemptId },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            percentage: attempt.maxScore === 0 ? 0 : (attempt.score / attempt.maxScore) * 100,
            answeredCount: attempt.answeredCount
          }
        });
        return { attemptId, status: 'COMPLETED', questionNumber: null, totalQuestions, question: null, questionStartedAt: null, allowedSeconds: null };
      }

      const questionStartedAt = snapshot.questionStartedAt ?? now;
      if (!snapshot.questionStartedAt) {
        await transaction.assessmentAttemptQuestion.update({ where: { id: snapshot.id }, data: { questionStartedAt } });
      }

      const allowedSeconds = snapshot.question.expertiseLevel.secondsPerQuestion;
      if (now.getTime() - questionStartedAt.getTime() > allowedSeconds * 1000) {
        await transaction.assessmentAttemptQuestion.update({
          where: { id: snapshot.id },
          data: { timedOut: true, timeSpent: Math.max(0, Math.floor((now.getTime() - questionStartedAt.getTime()) / 1000)) }
        });
        continue;
      }

      return {
        attemptId,
        status: 'IN_PROGRESS',
        questionNumber: snapshot.position + 1,
        totalQuestions,
        question: toCandidateQuestion(snapshot.question),
        questionStartedAt,
        allowedSeconds
      };
    }
  });
}
