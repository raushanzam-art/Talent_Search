import { describe, expect, it, vi } from 'vitest';
import { AttemptNotCompletedError } from './attemptDetail.service';
import { getAttemptAnswerDetails } from './attemptDetail.service';
import { AttemptNotFoundError } from './answer.service';

function makeQuestion(prefix: string, correctSuffix: string) {
  return {
    id: `${prefix}`,
    questionCode: `CODE-${prefix}`,
    text: `Text for ${prefix}`,
    questionType: 'VERBAL',
    difficulty: 'Easy',
    explanation: `Explanation for ${prefix}`,
    skill: { id: 'skill-1', name: 'Verbal Reasoning' },
    category: { id: 'category-1', name: 'Secondary' },
    expertiseLevel: { id: 'level-1', name: 'Beginner', secondsPerQuestion: 28 },
    options: [
      { id: `${prefix}-${correctSuffix}`, optionText: 'Right', score: 3, isCorrect: true },
      { id: `${prefix}-wrong-a`, optionText: 'WrongA', score: 1, isCorrect: false },
      { id: `${prefix}-wrong-b`, optionText: 'WrongB', score: 2, isCorrect: false }
    ]
  };
}

const submittedAt = new Date('2026-01-01T00:00:10.000Z');

const baseAttempt = {
  id: 'attempt-1',
  userId: 'user-1',
  assessmentId: 'assessment-1',
  status: 'COMPLETED',
  score: 4,
  maxScore: 9,
  percentage: null,
  assessment: { id: 'assessment-1', name: 'Test Assessment' },
  questions: [
    { position: 0, questionId: 'q1', timedOut: false, timeSpent: 10, question: makeQuestion('q1', 'correct') },
    { position: 1, questionId: 'q2', timedOut: false, timeSpent: 15, question: makeQuestion('q2', 'correct') },
    { position: 2, questionId: 'q3', timedOut: true, timeSpent: 28, question: makeQuestion('q3', 'correct') }
  ],
  answers: [
    { questionId: 'q1', optionId: 'q1-correct', score: 3, timeSpent: 10, submittedAt },
    { questionId: 'q2', optionId: 'q2-wrong-a', score: 1, timeSpent: 15, submittedAt }
  ]
};

function prismaMock(attempt: unknown = baseAttempt) {
  return { assessmentAttempt: { findUnique: vi.fn().mockResolvedValue(attempt) } } as never;
}

const candidate = { id: 'user-1', email: 'candidate@example.com', firstName: 'C', lastName: 'A', role: 'CANDIDATE' as const, active: true };
const otherCandidate = { ...candidate, id: 'user-2' };
const admin = { ...candidate, id: 'admin-1', role: 'ADMIN' as const };

describe('getAttemptAnswerDetails', () => {
  it('derives isCorrect, candidateAnswer, correctAnswer, and timedOut per question', async () => {
    const report = await getAttemptAnswerDetails(prismaMock(), candidate, 'attempt-1', { page: 1, pageSize: 20 });

    expect(report.totalQuestions).toBe(3);
    expect(report.matchingQuestions).toBe(3);
    expect(report.questions[0]).toMatchObject({ questionId: 'q1', isCorrect: true, isTimedOut: false, candidateAnswer: { optionId: 'q1-correct' } });
    expect(report.questions[1]).toMatchObject({ questionId: 'q2', isCorrect: false, isTimedOut: false, candidateAnswer: { optionId: 'q2-wrong-a' } });
    expect(report.questions[2]).toMatchObject({ questionId: 'q3', isCorrect: false, isTimedOut: true, candidateAnswer: null });
    expect(report.questions[2].correctAnswer).toEqual({ optionId: 'q3-correct', optionText: 'Right' });
    expect(report.questions[0].maxScore).toBe(3);
  });

  it('filters by status=correct', async () => {
    const report = await getAttemptAnswerDetails(prismaMock(), candidate, 'attempt-1', { status: 'correct', page: 1, pageSize: 20 });
    expect(report.matchingQuestions).toBe(1);
    expect(report.questions.map((q) => q.questionId)).toEqual(['q1']);
  });

  it('filters by status=incorrect', async () => {
    const report = await getAttemptAnswerDetails(prismaMock(), candidate, 'attempt-1', { status: 'incorrect', page: 1, pageSize: 20 });
    expect(report.questions.map((q) => q.questionId)).toEqual(['q2']);
  });

  it('filters by status=timedOut', async () => {
    const report = await getAttemptAnswerDetails(prismaMock(), candidate, 'attempt-1', { status: 'timedOut', page: 1, pageSize: 20 });
    expect(report.questions.map((q) => q.questionId)).toEqual(['q3']);
  });

  it('paginates the (optionally filtered) question list', async () => {
    const report = await getAttemptAnswerDetails(prismaMock(), candidate, 'attempt-1', { page: 2, pageSize: 1 });
    expect(report.matchingQuestions).toBe(3);
    expect(report.totalPages).toBe(3);
    expect(report.questions).toHaveLength(1);
    expect(report.questions[0].questionId).toBe('q2');
  });

  it('allows an admin to view any candidate attempt', async () => {
    const report = await getAttemptAnswerDetails(prismaMock(), admin, 'attempt-1', { page: 1, pageSize: 20 });
    expect(report.attemptId).toBe('attempt-1');
  });

  it('rejects a candidate viewing someone else\'s attempt', async () => {
    await expect(getAttemptAnswerDetails(prismaMock(), otherCandidate, 'attempt-1', { page: 1, pageSize: 20 }))
      .rejects.toBeInstanceOf(AttemptNotFoundError);
  });

  it('rejects an unknown attempt id', async () => {
    await expect(getAttemptAnswerDetails(prismaMock(null), candidate, 'missing-attempt', { page: 1, pageSize: 20 }))
      .rejects.toBeInstanceOf(AttemptNotFoundError);
  });

  it('rejects an attempt that is still in progress', async () => {
    const inProgress = { ...baseAttempt, status: 'IN_PROGRESS' };
    await expect(getAttemptAnswerDetails(prismaMock(inProgress), candidate, 'attempt-1', { page: 1, pageSize: 20 }))
      .rejects.toBeInstanceOf(AttemptNotCompletedError);
  });
});
