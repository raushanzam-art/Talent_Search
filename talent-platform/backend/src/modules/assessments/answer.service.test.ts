import { describe, expect, it, vi } from 'vitest';
import {
  AttemptQuestionError,
  DuplicateAnswerError,
  calculateElapsedSeconds,
  calculateAssessmentResult,
  submitAnswer
} from './answer.service';

const candidateQuestion = {
  id: 'question-2',
  questionCode: 'Q-002',
  text: 'Next question',
  questionType: 'VERBAL',
  difficulty: 'Easy',
  language: 'en',
  explanation: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  skill: { id: 'skill-1', name: 'Verbal Reasoning' },
  expertiseLevel: { id: 'level-1', name: 'Beginner', secondsPerQuestion: 28 },
  options: [{ id: 'option-2', optionText: 'Next option' }]
};

const questionStartedAt = new Date('2026-01-01T00:00:00.000Z');

function createPrismaMock(overrides: Record<string, unknown> = {}) {
  const transaction = {
    assessmentAttempt: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'attempt-1', userId: 'user-1', status: 'IN_PROGRESS', score: 0, maxScore: 6
      }),
      update: vi.fn().mockResolvedValue(undefined)
    },
    assessmentAttemptQuestion: {
      findFirst: vi.fn()
        .mockResolvedValueOnce({
          id: 'snapshot-1',
          timedOut: false,
          questionStartedAt,
          question: { expertiseLevel: { secondsPerQuestion: 28 } }
        })
        .mockResolvedValueOnce({ id: 'snapshot-2', questionStartedAt, question: candidateQuestion }),
      update: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0),
      findMany: vi.fn().mockResolvedValue([{ question: candidateQuestion }])
    },
    questionOption: {
      findFirst: vi.fn().mockResolvedValue({ id: 'option-1', score: 3 })
    },
    candidateAnswer: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(1),
      aggregate: vi.fn().mockResolvedValue({ _sum: { score: 3 } }),
      findMany: vi.fn().mockResolvedValue([{ questionId: 'question-1' }])
    },
    ...overrides
  };

  return {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction)),
    transaction
  };
}

describe('submitAnswer', () => {
  it('stores the database score and returns the next question', async () => {
    const prisma = createPrismaMock();
    const result = await submitAnswer(prisma as never, 'user-1', 'attempt-1', 'question-1', 'option-1', new Date('2026-01-01T00:00:10.000Z'));

    expect(result.nextQuestion?.id).toBe('question-2');
    expect(result.result).toEqual({ score: 3, maxScore: 6, percentage: 50, answeredCount: 1 });
    expect(prisma.transaction.candidateAnswer.create).toHaveBeenCalledWith({
      data: { attemptId: 'attempt-1', questionId: 'question-1', optionId: 'option-1', score: 3, timeSpent: 10 }
    });
  });

  it('accepts a submission just before the timeout', async () => {
    const prisma = createPrismaMock();
    const result = await submitAnswer(prisma as never, 'user-1', 'attempt-1', 'question-1', 'option-1', new Date('2026-01-01T00:00:27.999Z'));

    expect(result.result.score).toBe(3);
    expect(prisma.transaction.candidateAnswer.create).toHaveBeenCalled();
  });

  it('records a timed-out question and advances without an answer', async () => {
    const prisma = createPrismaMock();
    const result = await submitAnswer(prisma as never, 'user-1', 'attempt-1', 'question-1', undefined, new Date('2026-01-01T00:00:28.001Z'));

    expect(result.nextQuestion?.id).toBe('question-2');
    expect(prisma.transaction.candidateAnswer.create).not.toHaveBeenCalled();
    expect(prisma.transaction.assessmentAttemptQuestion.update).toHaveBeenCalledWith({
      where: { id: 'snapshot-1' },
      data: { timeSpent: 28, timedOut: true }
    });
  });

  it('rejects an option that does not belong to the question', async () => {
    const prisma = createPrismaMock({
      questionOption: { findFirst: vi.fn().mockResolvedValue(null) }
    });

    await expect(submitAnswer(prisma as never, 'user-1', 'attempt-1', 'question-1', 'wrong-option', new Date('2026-01-01T00:00:10.000Z')))
      .rejects.toBeInstanceOf(AttemptQuestionError);
  });

  it('rejects a question that does not belong to the attempt', async () => {
    const prisma = createPrismaMock({
      assessmentAttemptQuestion: { findFirst: vi.fn().mockResolvedValue(null) }
    });

    await expect(submitAnswer(prisma as never, 'user-1', 'attempt-1', 'other-question', 'option-1'))
      .rejects.toBeInstanceOf(AttemptQuestionError);
  });

  it('rejects duplicate answer submissions', async () => {
    const prisma = createPrismaMock({
      candidateAnswer: { findFirst: vi.fn().mockResolvedValue({ id: 'answer-1' }) }
    });

    await expect(submitAnswer(prisma as never, 'user-1', 'attempt-1', 'question-1', 'option-1'))
      .rejects.toBeInstanceOf(DuplicateAnswerError);
  });
});

describe('calculateAssessmentResult', () => {
  it('calculates raw score, maximum score, answered count, and percentage', () => {
    expect(calculateAssessmentResult(7, 10, 3)).toEqual({
      score: 7,
      maxScore: 10,
      percentage: 70,
      answeredCount: 3
    });
  });
});

describe('calculateElapsedSeconds', () => {
  it('calculates elapsed whole seconds from server timestamps', () => {
    expect(calculateElapsedSeconds(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:12.750Z')
    )).toBe(12);
  });
});
