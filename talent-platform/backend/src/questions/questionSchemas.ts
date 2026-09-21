import { z } from 'zod';

export const questionTypeSchema = z.string().trim().min(1).max(100);

export const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']);

const questionOptionInputSchema = z.object({
  optionText: z.string().trim().min(1),
  score: z.number().int().min(1).max(3),
  isCorrect: z.boolean()
}).strict();

export const questionInputSchema = z.object({
  questionCode: z.string().trim().min(1),
  text: z.string().trim().min(1),
  skillId: z.string().uuid(),
  expertiseLevelId: z.string().uuid(),
  type: questionTypeSchema,
  difficulty: difficultySchema,
  language: z.string().trim().min(2),
  explanation: z.string().trim().min(1).optional(),
  active: z.boolean().default(true),
  options: z.array(questionOptionInputSchema).length(3)
}).strict().superRefine((question, context) => {
  const scores = question.options.map((option) => option.score).sort();
  if (scores.join(',') !== '1,2,3') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Options must contain one score each of 1, 2, and 3.'
    });
  }

  if (question.options.filter((option) => option.isCorrect).length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Exactly one option must be marked as correct.'
    });
  }
});

export const questionIdSchema = z.object({
  id: z.string().uuid()
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
