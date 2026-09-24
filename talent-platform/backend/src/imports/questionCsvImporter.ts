import { parse } from 'csv-parse/sync';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { maxScoreValue } from '../questions/questionSchemas';

const allowedDifficulties = new Set(['Easy', 'Medium', 'Hard']);
const requiredColumns = ['questionCode', 'skill', 'level', 'type', 'difficulty', 'language', 'questionText', 'option1', 'score1', 'option2', 'score2', 'option3', 'score3', 'explanation'] as const;
const optionalColumns = ['option4', 'score4', 'option5', 'score5'] as const;
type RequiredColumn = (typeof requiredColumns)[number];
type OptionalColumn = (typeof optionalColumns)[number];
type CsvColumn = RequiredColumn | OptionalColumn;
type CsvQuestionRow = Record<CsvColumn, string> & { categoryId: string };

const optionColumns = ['option1', 'option2', 'option3', 'option4', 'option5'] as const;
const scoreColumns = ['score1', 'score2', 'score3', 'score4', 'score5'] as const;
const requiredGenericColumns = ['questionCode', 'skill', 'level', 'type', 'difficulty', 'language', 'questionText', 'explanation'] as const;

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
  categoryId?: string;
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

function validateHeader(csvContent: string): string[] {
  const headerRows = parse(csvContent, { to_line: 1, skip_empty_lines: true, trim: true, bom: true }) as string[][];
  const header = headerRows[0] ?? [];
  const errors: string[] = [];

  if (header.length === 0) {
    return ['CSV file is empty or missing a header row.'];
  }

  const missing = requiredColumns.filter((column) => !header.includes(column));
  if (missing.length > 0) errors.push(`Missing required column(s): ${missing.join(', ')}.`);

  const counts = new Map<string, number>();
  header.forEach((column) => { if (column) counts.set(column, (counts.get(column) ?? 0) + 1); });
  const duplicated = [...counts.entries()].filter(([, count]) => count > 1).map(([column]) => column);
  if (duplicated.length > 0) errors.push(`Duplicate column header(s): ${duplicated.join(', ')}.`);

  const knownColumns = new Set<string>([...requiredColumns, 'categoryId', ...optionalColumns]);
  const unknown = [...new Set(header.filter((column) => column && !knownColumns.has(column)))];
  if (unknown.length > 0) errors.push(`Unrecognized column header(s): ${unknown.join(', ')}.`);

  return errors;
}

export async function validateQuestionsCsv(prisma: PrismaClient, csvContent: string): Promise<ValidatedQuestionCsv> {
  const report = emptyReport();

  const headerErrors = validateHeader(csvContent);
  if (headerErrors.length > 0) {
    report.errors.push({ row: 1, messages: headerErrors.map((message) => `Row 1 – header: ${message}`) });
    return { report, rows: [] };
  }

  const parsedRows = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Array<Record<string, string>>;
  const rows = parsedRows.map((parsedRow) => [...requiredColumns, ...optionalColumns].reduce((row, column) => {
    row[column] = parsedRow[column] ?? '';
    return row;
  }, { categoryId: parsedRow.categoryId ?? '' } as CsvQuestionRow));
  report.totalRows = rows.length;

  const [skills, levels, questionTypes, categories, existingQuestions] = await Promise.all([
    prisma.skill.findMany({ select: { id: true, name: true } }),
    prisma.expertiseLevel.findMany({ select: { id: true, name: true } }),
    prisma.questionType.findMany({ where: { active: true }, select: { name: true } }),
    prisma.questionCategory.findMany({ where: { active: true }, select: { id: true } }),
    prisma.question.findMany({ select: { questionCode: true } })
  ]);
  const skillIds = new Map(skills.map((skill) => [skill.name, skill.id]));
  const levelIds = new Map(levels.map((level) => [level.name, level.id]));
  const allowedQuestionTypes = new Set(questionTypes.map((type) => type.name));
  const categoryIds = new Set(categories.map((category) => category.id));
  const seenCodes = new Set<string>();
  const validRows: ValidatedQuestion[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const field = (name: string, reason: string): void => {
      errors.push(`Row ${rowNumber} – ${row.questionCode || '(no code)'} – ${name}: ${reason}`);
    };

    requiredGenericColumns.forEach((column) => {
      if (row[column].trim() === '') field(column, `${column} is required.`);
    });

    if (row.questionCode && seenCodes.has(row.questionCode)) {
      field('questionCode', `Duplicate question code: ${row.questionCode}`);
      report.duplicateRows += 1;
    }
    if (row.skill && !skillIds.has(row.skill)) field('skill', `Skill does not exist: ${row.skill}`);
    if (row.level && !levelIds.has(row.level)) field('level', `Expertise level does not exist: ${row.level}`);
    if (row.type && !allowedQuestionTypes.has(row.type)) field('type', `Invalid question type: ${row.type}`);
    if (row.categoryId && !categoryIds.has(row.categoryId)) field('categoryId', `Question category does not exist or is inactive: ${row.categoryId}`);
    if (row.difficulty && !allowedDifficulties.has(row.difficulty)) field('difficulty', `Invalid difficulty: ${row.difficulty}`);

    ([0, 1, 2] as const).forEach((optionIndex) => {
      const column = optionColumns[optionIndex];
      if (row[column].trim() === '') field(column, `Option ${optionIndex + 1} is required.`);
    });

    const option4Populated = row.option4.trim() !== '';
    const option5Populated = row.option5.trim() !== '';
    if (option5Populated && !option4Populated) {
      field('option5', 'Option 4 must be populated before Option 5.');
    }
    if (!option4Populated && row.score4.trim() !== '') {
      field('score4', 'Score 4 must not be set without Option 4.');
    }
    if (!option5Populated && row.score5.trim() !== '') {
      field('score5', 'Score 5 must not be set without Option 5.');
    }

    const optionCount = option4Populated && option5Populated ? 5 : option4Populated ? 4 : 3;
    const activeOptionColumns = optionColumns.slice(0, optionCount);
    const activeScoreColumns = scoreColumns.slice(0, optionCount);

    const scores: Array<number | undefined> = activeScoreColumns.map((scoreColumn, optionIndex) => {
      const optionColumn = activeOptionColumns[optionIndex];
      const raw = row[scoreColumn];
      if (row[optionColumn].trim() === '') return undefined;
      if (raw.trim() === '') {
        field(scoreColumn, `${scoreColumn} is required when ${optionColumn} is populated.`);
        return undefined;
      }
      const parsed = parseScore(raw);
      if (parsed === undefined || parsed < 0 || parsed > maxScoreValue) {
        field(scoreColumn, `Invalid score value. Must be an integer between 0 and ${maxScoreValue}.`);
        return undefined;
      }
      return parsed;
    });

    let highestScore: number | undefined;
    if (scores.every((score) => score !== undefined)) {
      const definedScores = scores as number[];
      highestScore = Math.max(...definedScores);
      const highestScoreCount = definedScores.filter((score) => score === highestScore).length;
      if (highestScoreCount !== 1) {
        field('score', 'Exactly one option must have the highest score to indicate the correct answer.');
      }
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
        ...(row.categoryId ? { categoryId: row.categoryId } : {}),
        options: activeOptionColumns.map((column, optionIndex) => ({
          optionText: row[column],
          score: scores[optionIndex]!,
          isCorrect: scores[optionIndex] === highestScore
        }))
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
      await prisma.question.upsert({
        where: { questionCode: row.questionCode },
        create: {
          questionCode: row.questionCode,
          text: row.text,
          skillId: row.skillId,
          expertiseLevelId: row.expertiseLevelId,
          questionType: row.questionType,
          difficulty: row.difficulty,
          language: row.language,
          explanation: row.explanation,
          ...(row.categoryId ? { categoryId: row.categoryId } : {}),
          options: { create: row.options }
        },
        update: {
          text: row.text, skillId: row.skillId, expertiseLevelId: row.expertiseLevelId, questionType: row.questionType,
          difficulty: row.difficulty, language: row.language, explanation: row.explanation,
          ...(row.categoryId ? { categoryId: row.categoryId } : {}),
          options: { deleteMany: {}, create: row.options }
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
