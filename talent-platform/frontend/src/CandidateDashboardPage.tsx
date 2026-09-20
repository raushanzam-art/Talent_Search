import { useEffect, useState } from 'react';
import { CandidateAssignment, getCandidateAssignments, startAssessment } from './api';

export function CandidateDashboardPage() {
  const token = localStorage.getItem('talent_token') ?? '';
  const [assignments, setAssignments] = useState<CandidateAssignment[]>([]);
  const [error, setError] = useState('');

  async function load(): Promise<void> { setAssignments((await getCandidateAssignments(token)).data); }
  useEffect(() => { if (!token) { window.location.href = '/login'; return; } void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load assignments.')); }, [token]);

  async function start(assignment: CandidateAssignment): Promise<void> {
    try { const result = await startAssessment(token, assignment.assessmentId); window.location.href = `/assessment/${result.data.attemptId}`; } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not start assessment.'); }
  }

  return <main className="page narrow-page"><header className="section-heading"><div><p className="eyebrow">Candidate portal</p><h1>Your assessments</h1></div><button type="button" onClick={() => { localStorage.removeItem('talent_token'); window.location.href = '/login'; }}>Sign out</button></header>{error && <p className="error">{error}</p>}<div className="panel">{assignments.length === 0 ? <p>No assessments have been assigned yet.</p> : assignments.map((assignment) => <div className="assignment-card" key={assignment.id}><h2>{assignment.assessment.name}</h2><p>{assignment.assessment.questionCount} questions</p>{assignment.attempt ? <a href={`/assessment/${assignment.attempt.id}`}>Continue assessment</a> : <button type="button" onClick={() => void start(assignment)}>Start assessment</button>}</div>)}</div></main>;
}
