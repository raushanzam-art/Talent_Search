import { describe, expect, it, vi } from 'vitest';
import { validateQuestionsCsv } from './questionCsvImporter';

const header = 'questionCode,skill,level,type,difficulty,language,questionText,option1,score1,option2,score2,option3,score3,explanation';
const row = (code: string) => `${code},Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the best response","Poor",1,"Good",2,"Excellent",3,"Explanation"`;

function prismaMock(existingCodes: string[] = []) {
  return {
    skill: { findMany: vi.fn().mockResolvedValue([{ id: 'skill-1', name: 'Verbal Reasoning' }]) },
    expertiseLevel: { findMany: vi.fn().mockResolvedValue([{ id: 'level-1', name: 'Beginner' }]) },
    questionType: { findMany: vi.fn().mockResolvedValue([{ name: 'VERBAL' }]) },
    questionCategory: { findMany: vi.fn().mockResolvedValue([{ id: 'primary' }]) },
    question: { findMany: vi.fn().mockResolvedValue(existingCodes.map((questionCode) => ({ questionCode }))) }
  } as never;
}

const header5 = 'questionCode,skill,level,type,difficulty,language,questionText,option1,score1,option2,score2,option3,score3,option4,score4,option5,score5,explanation';

describe('question CSV validation', () => {
  it('validates required fields, references, types, difficulty, and scores', async () => {
    const result = await validateQuestionsCsv(prismaMock(), `${header}\n${row('CSV-001')}`);
    expect(result.report).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0, duplicateRows: 0 });
    expect(result.rows).toHaveLength(1);
  });

  it('allows an existing question to be updated but detects duplicate rows in the CSV', async () => {
    const result = await validateQuestionsCsv(prismaMock(['CSV-001']), `${header}\n${row('CSV-001')}\n${row('CSV-001')}`);
    expect(result.report).toMatchObject({ totalRows: 2, validRows: 1, invalidRows: 1, duplicateRows: 1 });
    expect(result.report.errors.every((error) => error.messages[0].includes('Duplicate question code'))).toBe(true);
  });

  it('imports an old-format CSV with no categoryId/option4/option5 columns at all (backward compatibility)', async () => {
    const result = await validateQuestionsCsv(prismaMock(), `${header}\n${row('LEGACY-001')}`);
    expect(result.report).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0 });
    expect(result.rows[0].options).toHaveLength(3);
  });

  it('accepts a 4-option row with option4/score4 populated and option5/score5 blank', async () => {
    const row4 = 'CSV-4OPT,Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the best response","Poor",1,"Good",2,"Great",3,"Excellent",4,,,"Explanation"';
    const result = await validateQuestionsCsv(prismaMock(), `${header5}\n${row4}`);
    expect(result.report).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0 });
    expect(result.rows[0].options).toHaveLength(4);
    expect(result.rows[0].options[3]).toMatchObject({ optionText: 'Excellent', score: 4, isCorrect: true });
  });

  it('accepts a 5-option row with all five options populated', async () => {
    const row5 = 'CSV-5OPT,Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the best response","Worst",1,"Poor",2,"Fair",3,"Good",4,"Best",5,"Explanation"';
    const result = await validateQuestionsCsv(prismaMock(), `${header5}\n${row5}`);
    expect(result.report).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0 });
    expect(result.rows[0].options).toHaveLength(5);
    expect(result.rows[0].options[4]).toMatchObject({ optionText: 'Best', score: 5, isCorrect: true });
  });

  it('rejects option5 populated while option4 is blank (non-sequential options)', async () => {
    const badRow = 'CSV-GAP,Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the best response","Poor",1,"Good",2,"Excellent",3,,,"Best",4,"Explanation"';
    const result = await validateQuestionsCsv(prismaMock(), `${header5}\n${badRow}`);
    expect(result.report).toMatchObject({ validRows: 0, invalidRows: 1 });
    expect(result.report.errors[0].messages.some((message) => message.includes('Option 4 must be populated before Option 5'))).toBe(true);
  });

  it('rejects a negative score4 value', async () => {
    const badRow = 'CSV-BADSCORE,Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the best response","Poor",1,"Good",2,"Excellent",3,"Extra",-1,,,"Explanation"';
    const result = await validateQuestionsCsv(prismaMock(), `${header5}\n${badRow}`);
    expect(result.report).toMatchObject({ validRows: 0, invalidRows: 1 });
    expect(result.report.errors[0].messages.some((message) => message.includes('score4') && message.includes('Invalid score value'))).toBe(true);
  });

  it('rejects a row where two options tie for the highest score', async () => {
    const badRow = 'CSV-TIE,Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the best response","Poor",3,"Good",2,"Excellent",3,"Explanation"';
    const result = await validateQuestionsCsv(prismaMock(), `${header}\n${badRow}`);
    expect(result.report).toMatchObject({ validRows: 0, invalidRows: 1 });
    expect(result.report.errors[0].messages.some((message) => message.includes('Exactly one option must have the highest score'))).toBe(true);
  });

  it('accepts simple right/wrong marking (correct option = 1, every wrong option = 0)', async () => {
    const binaryRow = 'CSV-BINARY,Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the best response","Wrong A",0,"Correct",1,"Wrong B",0,"Wrong C",0,"None of these",0,"Explanation"';
    const result = await validateQuestionsCsv(prismaMock(), `${header5}\n${binaryRow}`);
    expect(result.report).toMatchObject({ totalRows: 1, validRows: 1, invalidRows: 0 });
    expect(result.rows[0].options).toEqual([
      { optionText: 'Wrong A', score: 0, isCorrect: false },
      { optionText: 'Correct', score: 1, isCorrect: true },
      { optionText: 'Wrong B', score: 0, isCorrect: false },
      { optionText: 'Wrong C', score: 0, isCorrect: false },
      { optionText: 'None of these', score: 0, isCorrect: false }
    ]);
  });

  it('reports a clear row/code/field error when option3 is missing', async () => {
    const badRow = 'Q1025,Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the best response","Poor",1,"Good",2,,3,"Explanation"';
    const result = await validateQuestionsCsv(prismaMock(), `${header}\n${badRow}`);
    expect(result.report.errors[0].messages.some((message) => message === 'Row 2 – Q1025 – option3: Option 3 is required.')).toBe(true);
  });

  it('rejects a header missing a required column', async () => {
    const badHeader = 'questionCode,skill,level,type,difficulty,language,questionText,option1,score1,option2,score2,explanation';
    const result = await validateQuestionsCsv(prismaMock(), `${badHeader}\n${row('CSV-001')}`);
    expect(result.report.totalRows).toBe(0);
    expect(result.report.errors[0].messages[0]).toContain('Missing required column(s): option3, score3');
  });

  it('rejects a header with a duplicated column', async () => {
    const dupHeader = `${header},option1`;
    const result = await validateQuestionsCsv(prismaMock(), `${dupHeader}\n${row('CSV-001')},"Poor"`);
    expect(result.report.errors[0].messages[0]).toContain('Duplicate column header(s): option1');
  });

  it('rejects a header with an unrecognized/misspelled column', async () => {
    const typoHeader = header5.replace('option4', 'opton4');
    const result = await validateQuestionsCsv(prismaMock(), `${typoHeader}\n${row('CSV-001')},,,,`);
    expect(result.report.errors[0].messages[0]).toContain('Unrecognized column header(s): opton4');
  });
});
