import { describe, expect, it, vi } from 'vitest';
import { validateQuestionsCsv } from './questionCsvImporter';

const header = 'questionCode,skill,level,type,difficulty,language,questionText,option1,score1,option2,score2,option3,score3,explanation';
const row = (code: string) => `${code},Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the best response","Poor",1,"Good",2,"Excellent",3,"Explanation"`;

function prismaMock(existingCodes: string[] = []) {
  return {
    skill: { findMany: vi.fn().mockResolvedValue([{ id: 'skill-1', name: 'Verbal Reasoning' }]) },
    expertiseLevel: { findMany: vi.fn().mockResolvedValue([{ id: 'level-1', name: 'Beginner' }]) },
    question: { findMany: vi.fn().mockResolvedValue(existingCodes.map((questionCode) => ({ questionCode }))) }
  } as never;
}

describe('question CSV validation', () => {
  it('validates required fields, references, types, difficulty, and scores', async () => {
    const result = await validateQuestionsCsv(prismaMock(), `${header}\n${row('CSV-001')}`);
    expect(result.report).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0, duplicateRows: 0 });
    expect(result.rows).toHaveLength(1);
  });

  it('detects duplicate question codes already in the database and CSV', async () => {
    const result = await validateQuestionsCsv(prismaMock(['CSV-001']), `${header}\n${row('CSV-001')}\n${row('CSV-001')}`);
    expect(result.report).toMatchObject({ totalRows: 2, validRows: 0, invalidRows: 2, duplicateRows: 2 });
    expect(result.report.errors.every((error) => error.messages[0].includes('Duplicate question code'))).toBe(true);
  });
});
