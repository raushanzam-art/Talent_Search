import { z } from 'zod';

export const questionTypeSchema = z.string().trim().min(1).max(100);

export const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);

export const minOptionCount = 3;
export const maxOptionCount = 5;
export const maxScoreValue = 100;

const questionOptionInputSchema = z.object({
  optionText: z.string().trim().min(1),
  score: z.number().int().min(0).max(maxScoreValue),
  isCorrect: z.boolean()
}).strict();

export const questionInputSchema = z.object({
  questionCode: z.string().trim().min(1),
  text: z.string().trim().min(1),
  skillId: z.string().uuid(),
  expertiseLevelId: z.string().uuid(),
  categoryId: z.string().trim().min(1).max(100).optional(),
  type: questionTypeSchema,
  difficulty: difficultySchema,
  language: z.string().trim().min(2),
  explanation: z.string().trim().min(1).optional(),
  active: z.boolean().default(true),
  options: z.array(questionOptionInputSchema).min(minOptionCount).max(maxOptionCount)
}).strict().superRefine((question, context) => {
  const correctOptions = question.options.filter((option) => option.isCorrect);
  if (correctOptions.length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Exactly one option must be marked as correct.'
    });
    return;
  }

  const correctScore = correctOptions[0].score;
  const highestOtherScore = Math.max(...question.options.filter((option) => !option.isCorrect).map((option) => option.score));
  if (correctScore <= highestOtherScore) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'The correct option must have a higher score than every incorrect option.'
    });
  }
});

export const questionIdSchema = z.object({
  id: z.string().uuid()
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
