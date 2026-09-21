const API_BASE = 'http://localhost:3000/api/v1';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'CANDIDATE' | 'ADMIN';
  active: boolean;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

export interface ExpertiseLevel {
  id: string;
  name: string;
  secondsPerQuestion: number;
  active: boolean;
}

export interface QuestionType {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

export interface QuestionOption {
  id: string;
  optionText: string;
  score?: number;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  questionCode: string;
  text: string;
  skill: { id: string; name: string };
  expertiseLevel: { id: string; name: string; secondsPerQuestion: number };
  type: string;
  difficulty: string;
  language: string;
  explanation?: string;
  active: boolean;
  options: QuestionOption[];
}

export interface CurrentAttempt {
  attemptId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  questionNumber: number | null;
  totalQuestions: number;
  question: Question | null;
  questionStartedAt: string | null;
  allowedSeconds: number | null;
}

export interface AnswerSubmission {
  attemptId: string;
  answeredQuestionId: string;
  nextQuestion: Question | null;
  nextQuestionStartedAt: string | null;
  allowedSeconds: number | null;
}

export interface AssessmentResults {
  attemptId: string;
  assessmentId: string;
  assessmentName: string;
  status: string;
  score: number;
  maxScore: number;
  percentage: number;
  questionsAnswered: number;
  questionsTimedOut: number;
  totalQuestions: number;
  timeStatistics: {
    totalSeconds: number;
    averageSeconds: number;
    fastestSeconds: number | null;
    slowestSeconds: number | null;
  };
  skillResults: Array<{
    skillId: string;
    skillName: string;
    score: number;
    maxScore: number;
    percentage: number;
    questionsAnswered: number;
    questionsTimedOut: number;
  }>;
}

export interface QuestionImportReport {
  mode?: 'validate' | 'import';
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  errors: Array<{ row: number; messages: string[] }>;
  preview: Array<{ row: number; questionCode: string; skill: string; level: string; type: string; difficulty: string; questionText: string; valid: boolean; errors: string[] }>;
}

export interface CandidateAssignment {
  id: string;
  assessmentId: string;
  status: string;
  assessment: { id: string; name: string; questionCount: number };
  attempt: { id: string; status: string } | null;
}

export interface AdminAssessment {
  id: string;
  name: string;
  questionCount: number;
  active: boolean;
  questions: Array<{ questionId: string; position: number }>;
  assignments: Array<{ id: string; userId: string; status: string; user: { email: string; firstName: string; lastName: string } }>;
}

export interface CandidateSummary { id: string; email: string; firstName: string; lastName: string; }

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; details?: unknown } | null;
    throw new ApiError(response.status, body?.error ?? 'Request failed.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function login(email: string, password: string): Promise<AuthResult> {
  return request<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function getMe(token: string): Promise<{ user: AuthUser }> {
  return request('/auth/me', {}, token);
}

export function getQuestions(token: string): Promise<{ data: Question[] }> {
  return request('/questions', {}, token);
}

export function saveQuestion(token: string, input: Record<string, unknown>, id?: string): Promise<{ data: Question }> {
  return request(`/questions${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) }, token);
}

export function deleteQuestion(token: string, id: string): Promise<void> {
  return request(`/questions/${id}`, { method: 'DELETE' }, token);
}

export function getSkills(token: string): Promise<{ data: Skill[] }> {
  return request('/admin/skills', {}, token);
}

export function saveSkill(token: string, input: Record<string, unknown>, id?: string): Promise<{ data: Skill }> {
  return request(`/admin/skills${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) }, token);
}

export function deleteSkill(token: string, id: string): Promise<void> {
  return request(`/admin/skills/${id}`, { method: 'DELETE' }, token);
}

export function getExpertiseLevels(token: string): Promise<{ data: ExpertiseLevel[] }> {
  return request('/admin/expertise-levels', {}, token);
}

export function saveExpertiseLevel(token: string, input: Record<string, unknown>, id?: string): Promise<{ data: ExpertiseLevel }> {
  return request(`/admin/expertise-levels${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) }, token);
}

export function deleteExpertiseLevel(token: string, id: string): Promise<void> {
  return request(`/admin/expertise-levels/${id}`, { method: 'DELETE' }, token);
}

export function getQuestionTypes(token: string): Promise<{ data: QuestionType[] }> { return request('/admin/question-types', {}, token); }
export function saveQuestionType(token: string, input: Record<string, unknown>, id?: string): Promise<{ data: QuestionType }> { return request(`/admin/question-types${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) }, token); }
export function deleteQuestionType(token: string, id: string): Promise<void> { return request(`/admin/question-types/${id}`, { method: 'DELETE' }, token); }

export function getCurrentAttempt(token: string, attemptId: string): Promise<{ data: CurrentAttempt }> {
  return request(`/attempts/${attemptId}/current`, {}, token);
}

export function submitAnswer(token: string, attemptId: string, questionId: string, optionId?: string): Promise<{ data: AnswerSubmission }> {
  return request(`/attempts/${attemptId}/answers`, {
    method: 'POST',
    body: JSON.stringify({ questionId, ...(optionId ? { optionId } : {}) })
  }, token);
}

export function getAssessmentResults(token: string, attemptId: string): Promise<{ data: AssessmentResults }> {
  return request(`/attempts/${attemptId}/results`, {}, token);
}

export function getCandidateAssignments(token: string): Promise<{ data: CandidateAssignment[] }> { return request('/candidate/assignments', {}, token); }
export function getAdminAssessments(token: string): Promise<{ data: AdminAssessment[] }> { return request('/admin/assessments', {}, token); }
export function getAdminCandidates(token: string): Promise<{ data: CandidateSummary[] }> { return request('/admin/users', {}, token); }
export function createAdminAssessment(token: string, input: { name: string; questionIds: string[] }): Promise<{ data: AdminAssessment }> { return request('/admin/assessments', { method: 'POST', body: JSON.stringify({ ...input, active: true }) }, token); }
export function assignAssessment(token: string, assessmentId: string, userId: string): Promise<unknown> { return request(`/admin/assessments/${assessmentId}/assign`, { method: 'POST', body: JSON.stringify({ userId }) }, token); }
export function startAssessment(token: string, assessmentId: string): Promise<{ data: { attemptId: string } }> { return request(`/assessments/${assessmentId}/start`, { method: 'POST' }, token); }

export async function importQuestionCsv(token: string, file: File, mode: 'validate' | 'import'): Promise<{ data: QuestionImportReport }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/admin/questions/import?mode=${mode}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? 'CSV import request failed.');
  }
  return response.json() as Promise<{ data: QuestionImportReport }>;
}
