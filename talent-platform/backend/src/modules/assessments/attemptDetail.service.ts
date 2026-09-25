import { Prisma, PrismaClient } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';
import { AttemptNotFoundError } from './answer.service';

export class AttemptNotCompletedError extends Error {
  constructor() {
    super('Attempt answer details are only available once the attempt is completed.');
    this.name = 'AttemptNotCompletedError';
  }
}

export type AttemptAnswerStatus = 'correct' | 'incorrect' | 'timedOut' | 'unanswered';

export interface AttemptAnswerDetailsQuery {
  status?: AttemptAnswerStatus;
  page: number;
  pageSize: number;
}

export interface AttemptAnswerOption {
  id: string;
  optionText: string;
  score: number;
  isCorrect: boolean;
}

export interface AttemptAnswerDetail {
  position: number;
  questionId: string;
  questionCode: string;
  text: string;
  type: string;
  difficulty: string;
  skill: { id: string; name: string };
  category: { id: string; name: string } | null;
  expertiseLevel: { id: string; name: string };
  allowedSeconds: number;
  maxScore: number;
  options: AttemptAnswerOption[];
  candidateAnswer: { optionId: string; optionText: string; score: number; submittedAt: Date; timeSpent: number } | null;
  correctAnswer: { optionId: string; optionText: string };
  explanation: string | null;
  isCorrect: boolean;
  isTimedOut: boolean;
  timeSpent: number;
}

export interface AttemptAnswersReport {
  attemptId: string;
  assessmentId: string;
  assessmentName: string;
  status: string;
  score: number;
  maxScore: number;
  percentage: number;
  totalQuestions: number;
  matchingQuestions: number;
  page: number;
  pageSize: number;
  totalPages: number;
  questions: AttemptAnswerDetail[];
}

const questionDetailSelect = {
  id: true,
  questionCode: true,
  text: true,
  questionType: true,
  difficulty: true,
  explanation: true,
  skill: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  expertiseLevel: { select: { id: true, name: true, secondsPerQuestion: true } },
  options: {
    select: { id: true, optionText: true, score: true, isCorrect: true },
    orderBy: { optionText: 'asc' as const }
  }
} satisfies Prisma.QuestionSelect;

function matchesStatus(detail: AttemptAnswerDetail, status: AttemptAnswerStatus): boolean {
  switch (status) {
    case 'correct':
      return detail.isCorrect;
    case 'incorrect':
      return !detail.isTimedOut && detail.candidateAnswer !== null && !detail.isCorrect;
    case 'timedOut':
      return detail.isTimedOut;
    case 'unanswered':
      return !detail.isTimedOut && detail.candidateAnswer === null;
    default:
      return true;
  }
}

export async function getAttemptAnswerDetails(
  prisma: PrismaClient,
  user: AuthUser,
  attemptId: string,
  query: AttemptAnswerDetailsQuery
): Promise<AttemptAnswersReport> {
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      assessment: { select: { id: true, name: true } },
      questions: {
        orderBy: { position: 'asc' },
        include: { question: { select: questionDetailSelect } }
      },
      answers: { select: { questionId: true, optionId: true, score: true, timeSpent: true, submittedAt: true } }
    }
  });

  if (!attempt || (user.role !== 'ADMIN' && attempt.userId !== user.id)) {
    throw new AttemptNotFoundError();
  }
  if (attempt.status !== 'COMPLETED') {
    throw new AttemptNotCompletedError();
  }

  const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));

  const allDetails: AttemptAnswerDetail[] = attempt.questions.map((snapshot) => {
    const question = snapshot.question;
    const answer = answersByQuestion.get(snapshot.questionId);
    const answeredOption = answer ? question.options.find((option) => option.id === answer.optionId) : undefined;
    const correctOption = question.options.find((option) => option.isCorrect)!;
    const maxScore = question.options.reduce((max, option) => Math.max(max, option.score), 0);

    return {
      position: snapshot.position + 1,
      questionId: question.id,
      questionCode: question.questionCode,
      text: question.text,
      type: question.questionType,
      difficulty: question.difficulty,
      skill: question.skill,
      category: question.category,
      expertiseLevel: { id: question.expertiseLevel.id, name: question.expertiseLevel.name },
      allowedSeconds: question.expertiseLevel.secondsPerQuestion,
      maxScore,
      options: question.options,
      candidateAnswer: answer && answeredOption
        ? { optionId: answer.optionId, optionText: answeredOption.optionText, score: answer.score, submittedAt: answer.submittedAt, timeSpent: answer.timeSpent }
        : null,
      correctAnswer: { optionId: correctOption.id, optionText: correctOption.optionText },
      explanation: question.explanation,
      isCorrect: answer?.optionId === correctOption.id,
      isTimedOut: snapshot.timedOut,
      timeSpent: snapshot.timeSpent
    };
  });

  const filtered = query.status ? allDetails.filter((detail) => matchesStatus(detail, query.status!)) : allDetails;
  const matchingQuestions = filtered.length;
  const totalPages = Math.max(1, Math.ceil(matchingQuestions / query.pageSize));
  const start = (query.page - 1) * query.pageSize;
  const pageItems = filtered.slice(start, start + query.pageSize);

  return {
    attemptId: attempt.id,
    assessmentId: attempt.assessmentId,
    assessmentName: attempt.assessment.name,
    status: attempt.status,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage ?? (attempt.maxScore === 0 ? 0 : (attempt.score / attempt.maxScore) * 100),
    totalQuestions: attempt.questions.length,
    matchingQuestions,
    page: query.page,
    pageSize: query.pageSize,
    totalPages,
    questions: pageItems
  };
}
