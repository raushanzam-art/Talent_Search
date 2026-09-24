import { describe, expect, it } from 'vitest';
import { questionInputSchema } from './questionSchemas';

const base = {
  questionCode: 'Q-001',
  text: 'Question text',
  skillId: '11111111-1111-4111-8111-111111111111',
  expertiseLevelId: '22222222-2222-4222-8222-222222222222',
  type: 'MULTIPLE_CHOICE',
  difficulty: 'Easy' as const,
  language: 'en',
  active: true
};

function options(scores: number[], correctIndex: number) {
  return scores.map((score, index) => ({ optionText: `Option ${index + 1}`, score, isCorrect: index === correctIndex }));
}

describe('questionInputSchema option count and scoring', () => {
  it('accepts exactly 3 options with scores 1-3', () => {
    const result = questionInputSchema.safeParse({ ...base, options: options([1, 2, 3], 2) });
    expect(result.success).toBe(true);
  });

  it('accepts 4 options with scores 1-4', () => {
    const result = questionInputSchema.safeParse({ ...base, options: options([1, 2, 3, 4], 3) });
    expect(result.success).toBe(true);
  });

  it('accepts 5 options with scores 1-5', () => {
    const result = questionInputSchema.safeParse({ ...base, options: options([1, 2, 3, 4, 5], 4) });
    expect(result.success).toBe(true);
  });

  it('rejects fewer than 3 options', () => {
    const result = questionInputSchema.safeParse({ ...base, options: options([1, 2], 1) });
    expect(result.success).toBe(false);
  });

  it('rejects more than 5 options', () => {
    const result = questionInputSchema.safeParse({ ...base, options: options([1, 2, 3, 4, 5, 6], 5) });
    expect(result.success).toBe(false);
  });

  it('rejects a 4-option question whose scores are not a 1-4 permutation', () => {
    const result = questionInputSchema.safeParse({ ...base, options: options([1, 2, 3, 3], 3) });
    expect(result.success).toBe(false);
  });

  it('rejects a question with zero correct options', () => {
    const scores = [1, 2, 3];
    const optionList = scores.map((score, index) => ({ optionText: `Option ${index + 1}`, score, isCorrect: false }));
    const result = questionInputSchema.safeParse({ ...base, options: optionList });
    expect(result.success).toBe(false);
  });

  it('rejects a question with more than one correct option', () => {
    const optionList = [
      { optionText: 'Option 1', score: 1, isCorrect: true },
      { optionText: 'Option 2', score: 2, isCorrect: true },
      { optionText: 'Option 3', score: 3, isCorrect: false }
    ];
    const result = questionInputSchema.safeParse({ ...base, options: optionList });
    expect(result.success).toBe(false);
  });
});
