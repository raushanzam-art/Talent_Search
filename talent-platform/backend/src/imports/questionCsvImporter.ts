import { parse } from 'csv-parse/sync';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const allowedQuestionTypes = new Set(['MULTIPLE_CHOICE', 'VERBAL', 'NUMERICAL', 'SPATIAL', 'NON_VERBAL', 'READING']);
const allowedDifficulties = new Set(['Easy', 'Medium', 'Hard']);
const requiredColumns = ['questionCode', 'skill', 'level', 'type', 'difficulty', 'language', 'questionText', 'option1', 'score1', 'option2', 'score2', 'option3', 'score3', 'explanation'] as const;
type RequiredColumn = (typeof requiredColumns)[number];
type CsvQuestionRow = Record<RequiredColumn, string>;

export interface ImportError { row: number; messages: string[]; }
export interface QuestionImportPreview { row: number; questionCode: string; skill: string; level: string; type: string; difficulty: string; questionText: string; valid: boolean; errors: string[]; }
export interface QuestionImportReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  errors: ImportError[];
  preview: QuestionImportPreview[];
}

interface ValidatedQuestion {
  questionCode: string;
  skillId: string;
  expertiseLevelId: string;
  text: string;
  questionType: string;
  difficulty: string;
  language: string;
  explanation: string;
  options: Array<{ optionText: string; score: number; isCorrect: boolean }>;
}

export interface ValidatedQuestionCsv { report: QuestionImportReport; rows: ValidatedQuestion[]; }

function emptyReport(): QuestionImportReport {
  return { totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0, importedRows: 0, errors: [], preview: [] };
}

function parseScore(value: string): number | undefined {
  const score = Number(value);
  return Number.isInteger(score) ? score : undefined;
}

export async function validateQuestionsCsv(prisma: PrismaClient, csvContent: string): Promise<ValidatedQuestionCsv> {
  const report = emptyReport();
  const parsedRows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Array<Record<string, string>>;
  const rows = parsedRows.map((parsedRow) => requiredColumns.reduce((row, column) => {
    row[column] = parsedRow[column] ?? '';
    return row;
  }, {} as CsvQuestionRow));
  report.totalRows = rows.length;

  const [skills, levels, existingQuestions] = await Promise.all([
    prisma.skill.findMany({ select: { id: true, name: true } }),
    prisma.expertiseLevel.findMany({ select: { id: true, name: true } }),
    prisma.question.findMany({ select: { questionCode: true } })
  ]);
  const skillIds = new Map(skills.map((skill) => [skill.name, skill.id]));
  const levelIds = new Map(levels.map((level) => [level.name, level.id]));
  const seenCodes = new Set(existingQuestions.map((question) => question.questionCode));
  const validRows: ValidatedQuestion[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const missing = requiredColumns.filter((column) => row[column].trim() === '');
    if (missing.length > 0) errors.push(`Missing required fields: ${missing.join(', ')}`);
    if (seenCodes.has(row.questionCode)) {
      errors.push(`Duplicate question code: ${row.questionCode}`);
      report.duplicateRows += 1;
    }
    if (!skillIds.has(row.skill) && row.skill) errors.push(`Skill does not exist: ${row.skill}`);
    if (!levelIds.has(row.level) && row.level) errors.push(`Expertise level does not exist: ${row.level}`);
    if (!allowedQuestionTypes.has(row.type)) errors.push(`Invalid question type: ${row.type}`);
    if (!allowedDifficulties.has(row.difficulty)) errors.push(`Invalid difficulty: ${row.difficulty}`);

    const scores = [parseScore(row.score1), parseScore(row.score2), parseScore(row.score3)];
    if (scores.some((score) => score === undefined || score < 1 || score > 3) || new Set(scores).size !== 3) {
      errors.push('Option scores must contain one each of 1, 2, and 3.');
    }

    const valid = errors.length === 0;
    report.preview.push({ row: rowNumber, questionCode: row.questionCode, skill: row.skill, level: row.level, type: row.type, difficulty: row.difficulty, questionText: row.questionText, valid, errors });
    if (valid) {
      report.validRows += 1;
      validRows.push({
        questionCode: row.questionCode,
        skillId: skillIds.get(row.skill)!,
        expertiseLevelId: levelIds.get(row.level)!,
        text: row.questionText,
        questionType: row.type,
        difficulty: row.difficulty,
        language: row.language,
        explanation: row.explanation,
        options: [row.option1, row.option2, row.option3].map((optionText, optionIndex) => ({ optionText, score: scores[optionIndex]!, isCorrect: scores[optionIndex] === 3 }))
      });
    } else {
      report.invalidRows += 1;
      report.errors.push({ row: rowNumber, messages: errors });
    }
    if (row.questionCode) seenCodes.add(row.questionCode);
  });

  return { report, rows: validRows };
}

export async function importValidatedQuestions(prisma: PrismaClient, validation: ValidatedQuestionCsv): Promise<QuestionImportReport> {
  for (const row of validation.rows) {
    try {
      await prisma.question.create({
        data: {
          questionCode: row.questionCode,
          text: row.text,
          skillId: row.skillId,
          expertiseLevelId: row.expertiseLevelId,
          questionType: row.questionType,
          difficulty: row.difficulty,
          language: row.language,
          explanation: row.explanation,
          options: { create: row.options }
        }
      });
      validation.report.importedRows += 1;
    } catch (error: unknown) {
      validation.report.invalidRows += 1;
      validation.report.errors.push({ row: validation.report.preview.find((preview) => preview.questionCode === row.questionCode)?.row ?? 0, messages: [error instanceof Error ? error.message : 'Database error while importing row.'] });
    }
  }
  return validation.report;
}

export async function importQuestionsFromCsv(prisma: PrismaClient, csvPath = path.resolve(process.cwd(), 'data/questions.csv')): Promise<QuestionImportReport> {
  const validation = await validateQuestionsCsv(prisma, await readFile(csvPath, 'utf8'));
  return importValidatedQuestions(prisma, validation);
}
