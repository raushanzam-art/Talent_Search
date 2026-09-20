import { PrismaClient } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';
import { AttemptNotFoundError } from './answer.service';

export interface SkillResult {
  skillId: string;
  skillName: string;
  score: number;
  maxScore: number;
  percentage: number;
  questionsAnswered: number;
  questionsTimedOut: number;
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
  skillResults: SkillResult[];
}

export async function getAssessmentResults(
  prisma: PrismaClient,
  user: AuthUser,
  attemptId: string
): Promise<AssessmentResults> {
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      assessment: { select: { id: true, name: true } },
      questions: {
        orderBy: { position: 'asc' },
        include: { question: { select: { skill: { select: { id: true, name: true } } } } }
      },
      answers: { select: { questionId: true, score: true, timeSpent: true } }
    }
  });

  if (!attempt || (user.role !== 'ADMIN' && attempt.userId !== user.id)) {
    throw new AttemptNotFoundError();
  }

  const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const skillMap = new Map<string, SkillResult>();
  let questionsTimedOut = 0;
  const times: number[] = [];

  for (const snapshot of attempt.questions) {
    const answer = answersByQuestion.get(snapshot.questionId);
    const timedOut = snapshot.timedOut;
    const score = answer?.score ?? 0;
    const timeSpent = answer?.timeSpent ?? snapshot.timeSpent;
    if (answer || timedOut) times.push(timeSpent);
    if (timedOut) questionsTimedOut += 1;

    const skill = snapshot.question.skill;
    const current = skillMap.get(skill.id) ?? {
      skillId: skill.id,
      skillName: skill.name,
      score: 0,
      maxScore: 0,
      percentage: 0,
      questionsAnswered: 0,
      questionsTimedOut: 0
    };
    current.score += score;
    current.maxScore += 3;
    if (answer) current.questionsAnswered += 1;
    if (timedOut) current.questionsTimedOut += 1;
    current.percentage = current.maxScore === 0 ? 0 : (current.score / current.maxScore) * 100;
    skillMap.set(skill.id, current);
  }

  const totalSeconds = times.reduce((sum, time) => sum + time, 0);
  const answered = attempt.answers.length;
  return {
    attemptId: attempt.id,
    assessmentId: attempt.assessmentId,
    assessmentName: attempt.assessment.name,
    status: attempt.status,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage ?? (attempt.maxScore === 0 ? 0 : (attempt.score / attempt.maxScore) * 100),
    questionsAnswered: answered,
    questionsTimedOut,
    totalQuestions: attempt.questions.length,
    timeStatistics: {
      totalSeconds,
      averageSeconds: times.length === 0 ? 0 : totalSeconds / times.length,
      fastestSeconds: times.length === 0 ? null : Math.min(...times),
      slowestSeconds: times.length === 0 ? null : Math.max(...times)
    },
    skillResults: [...skillMap.values()]
  };
}
