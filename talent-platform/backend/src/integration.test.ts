import bcrypt from 'bcrypt';
import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app';

const testDatabasePath = path.resolve(process.cwd(), 'prisma/test.db');
const testDatabaseUrl = 'file:./test.db';
const jwtSecret = 'integration-test-secret-long-enough';
process.env.DATABASE_URL = testDatabaseUrl;

const prisma = new PrismaClient();
const app = createApp(prisma, jwtSecret);
const email = `candidate-${Date.now()}@example.com`;
let candidateToken = '';
let candidateId = '';
let adminToken = '';
let assessmentId = '';
let attemptId = '';
let currentQuestionId = '';
let nextQuestionId = '';

const csv = [
  'questionCode,skill,level,type,difficulty,language,questionText,option1,score1,option2,score2,option3,score3,explanation',
  'INT-001,Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the best response","Poor",1,"Good",2,"Excellent",3,"Explanation"',
  'INT-002,Verbal Reasoning,Beginner,VERBAL,Easy,en,"Choose the next response","Poor",1,"Good",2,"Excellent",3,"Explanation"'
].join('\n');

describe.sequential('HTTP integration flow', () => {
  beforeAll(async () => {
    await rm(testDatabasePath, { force: true });
    await rm(`${testDatabasePath}-journal`, { force: true });
    execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'ignore'
    });
    await prisma.skill.create({ data: { name: 'Verbal Reasoning' } });
    await prisma.expertiseLevel.create({ data: { name: 'Beginner', secondsPerQuestion: 28 } });
    const passwordHash = await bcrypt.hash('AdminPassword123!', 4);
    await prisma.user.create({ data: { email: 'integration-admin@example.com', passwordHash, firstName: 'Integration', lastName: 'Admin', role: 'ADMIN' } });
    const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: 'integration-admin@example.com', password: 'AdminPassword123!' });
    adminToken = adminLogin.body.token as string;
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await rm(testDatabasePath, { force: true });
    await rm(`${testDatabasePath}-journal`, { force: true });
  }, 30_000);

  it('registers a candidate', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ firstName: 'Integration', lastName: 'Candidate', email, password: 'CandidatePassword123!' });
    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('CANDIDATE');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    candidateId = response.body.user.id as string;
  });

  it('logs the candidate in', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({ email, password: 'CandidatePassword123!' });
    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    candidateToken = response.body.token as string;
  });

  it('validates and imports questions through the admin upload endpoint', async () => {
    const validate = await request(app).post('/api/v1/admin/questions/import?mode=validate').set('Authorization', `Bearer ${adminToken}`).attach('file', Buffer.from(csv), { filename: 'questions.csv', contentType: 'text/csv' });
    expect(validate.status).toBe(200);
    expect(validate.body.data).toMatchObject({ mode: 'validate', totalRows: 2, validRows: 2, invalidRows: 0, importedRows: 0 });

    const imported = await request(app).post('/api/v1/admin/questions/import?mode=import').set('Authorization', `Bearer ${adminToken}`).attach('file', Buffer.from(csv), { filename: 'questions.csv', contentType: 'text/csv' });
    expect(imported.status).toBe(200);
    expect(imported.body.data).toMatchObject({ mode: 'import', importedRows: 2 });
  });

  it('creates and starts an assessment', async () => {
    const questions = await prisma.question.findMany({ orderBy: { questionCode: 'asc' }, select: { id: true } });
    const assessment = await prisma.assessment.create({ data: { name: 'Integration Assessment', questionCount: 2, questions: { create: questions.map((question, position) => ({ questionId: question.id, position })) } } });
    assessmentId = assessment.id;
    await prisma.assessmentAssignment.create({ data: { userId: candidateId, assessmentId } });
    const response = await request(app).post(`/api/v1/assessments/${assessmentId}/start`).set('Authorization', `Bearer ${candidateToken}`);
    expect(response.status).toBe(201);
    expect(response.body.data.question).not.toHaveProperty('score');
    expect(response.body.data.question).not.toHaveProperty('isCorrect');
    attemptId = response.body.data.attemptId as string;
    currentQuestionId = response.body.data.question.id as string;
  });

  it('submits the first answer and returns the next question', async () => {
    const question = await prisma.question.findUniqueOrThrow({ where: { id: currentQuestionId }, include: { options: true } });
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${candidateToken}`).send({ questionId: currentQuestionId, optionId: question.options[0].id });
    expect(response.status).toBe(200);
    expect(response.body.data.nextQuestion).toBeTruthy();
    expect(response.body.data.result.answeredCount).toBe(1);
    nextQuestionId = response.body.data.nextQuestion.id as string;
  });

  it('completes the assessment with the final answer', async () => {
    const question = await prisma.question.findUniqueOrThrow({ where: { id: nextQuestionId }, include: { options: true } });
    const response = await request(app).post(`/api/v1/attempts/${attemptId}/answers`).set('Authorization', `Bearer ${candidateToken}`).send({ questionId: nextQuestionId, optionId: question.options[0].id });
    expect(response.status).toBe(200);
    expect(response.body.data.nextQuestion).toBeNull();
    expect(response.body.data.result.answeredCount).toBe(2);
    expect(await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId }, select: { status: true, percentage: true } })).toMatchObject({ status: 'COMPLETED', percentage: expect.any(Number) });
  });

  it('allows the candidate to view own results and an admin to view all results', async () => {
    const candidateResult = await request(app).get(`/api/v1/attempts/${attemptId}/results`).set('Authorization', `Bearer ${candidateToken}`);
    expect(candidateResult.status).toBe(200);
    expect(candidateResult.body.data).toMatchObject({ score: expect.any(Number), maxScore: 6, percentage: expect.any(Number), questionsAnswered: 2, questionsTimedOut: 0 });
    expect(candidateResult.body.data).not.toHaveProperty('correctAnswers');

    const adminResult = await request(app).get(`/api/v1/attempts/${attemptId}/results`).set('Authorization', `Bearer ${adminToken}`);
    expect(adminResult.status).toBe(200);
  });
});
