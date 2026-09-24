import { describe, expect, it, vi } from 'vitest';
import { randomizeQuestionIds, startAssessment } from './assessment.service';

const candidateQuestion = {
  id: 'question-1', questionCode: 'Q-001', text: 'Question', questionType: 'VERBAL', difficulty: 'Easy', language: 'en', explanation: null, active: true,
  createdAt: new Date(), updatedAt: new Date(),
  skill: { id: 'skill-1', name: 'Verbal Reasoning' },
  expertiseLevel: { id: 'level-1', name: 'Beginner', secondsPerQuestion: 28 },
  options: [{ id: 'option-1', optionText: 'Answer' }]
};

describe('assessment creation and selection', () => {
  it('randomizes question IDs without changing the question set', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(randomizeQuestionIds(['q1', 'q2', 'q3']).sort()).toEqual(['q1', 'q2', 'q3']);
    vi.restoreAllMocks();
  });

  it('creates an attempt with an ordered question snapshot and max score', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'attempt-1', startedAt: new Date() });
    const prisma = {
      assessment: { findUnique: vi.fn().mockResolvedValue({
        id: 'assessment-1', active: true, questionCount: 2,
        questions: [
          { questionId: 'question-1', position: 0, question: { id: 'question-1', expertiseLevelId: 'level-1', options: [{ score: 1 }, { score: 2 }, { score: 3 }] } },
          { questionId: 'question-2', position: 1, question: { id: 'question-2', expertiseLevelId: 'level-1', options: [{ score: 1 }, { score: 2 }, { score: 3 }] } }
        ]
      }) },
      assessmentAssignment: { findUnique: vi.fn().mockResolvedValue({ id: 'assignment-1', status: 'ASSIGNED' }) },
      assessmentAttempt: { findFirst: vi.fn().mockResolvedValue(null) },
      assessmentAttemptQuestion: { findFirst: vi.fn().mockResolvedValue({ id: 'snapshot-1', questionStartedAt: new Date(), question: candidateQuestion }) },
      $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => callback({ assessmentAttempt: { create } }))
    } as never;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await startAssessment(prisma, 'user-1', 'assessment-1');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ maxScore: 6, questions: expect.objectContaining({ create: expect.any(Array) }) }) }));
    vi.restoreAllMocks();
  });
});
