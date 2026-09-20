import { useEffect, useState } from 'react';
import { AdminAssessment, assignAssessment, CandidateSummary, createAdminAssessment, getAdminAssessments, getAdminCandidates, getQuestions, Question } from './api';

export function AdminAssessmentPage({ token }: { token: string }) {
  const [assessments, setAssessments] = useState<AdminAssessment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [name, setName] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load(): Promise<void> {
    const [assessmentResult, questionResult, candidateResult] = await Promise.all([getAdminAssessments(token), getQuestions(token), getAdminCandidates(token)]);
    setAssessments(assessmentResult.data); setQuestions(questionResult.data); setCandidates(candidateResult.data);
  }
  useEffect(() => { void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load assessments.')); }, [token]);

  async function create(): Promise<void> {
    try { setError(''); await createAdminAssessment(token, { name, questionIds: selectedQuestions }); setName(''); setSelectedQuestions([]); setMessage('Assessment created.'); await load(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not create assessment.'); }
  }
  async function assign(): Promise<void> {
    try { setError(''); await assignAssessment(token, selectedAssessment, selectedCandidate); setMessage('Assessment assigned.'); await load(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not assign assessment.'); }
  }

  return <section><div className="section-heading"><div><h2>Assessments</h2><p>Create assessments and grant candidate access.</p></div></div>{error && <p className="error">{error}</p>}{message && <p>{message}</p>}
    <section className="panel form-grid"><h3>Create assessment</h3><label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Questions<select multiple value={selectedQuestions} onChange={(event) => setSelectedQuestions([...event.target.selectedOptions].map((option) => option.value))}>{questions.map((question) => <option key={question.id} value={question.id}>{question.questionCode} - {question.text}</option>)}</select></label><button type="button" onClick={() => void create()} disabled={!name || selectedQuestions.length === 0}>Create assessment</button></section>
+    <section className="panel form-grid"><h3>Assign assessment</h3><label>Assessment<select value={selectedAssessment} onChange={(event) => setSelectedAssessment(event.target.value)}><option value="">Select assessment</option>{assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.name}</option>)}</select></label><label>Candidate<select value={selectedCandidate} onChange={(event) => setSelectedCandidate(event.target.value)}><option value="">Select candidate</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.email}</option>)}</select></label><button type="button" onClick={() => void assign()} disabled={!selectedAssessment || !selectedCandidate}>Assign access</button></section>
+    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Questions</th><th>Assignments</th></tr></thead><tbody>{assessments.map((assessment) => <tr key={assessment.id}><td>{assessment.name}</td><td>{assessment.questionCount}</td><td>{assessment.assignments.map((assignment) => assignment.user.email).join(', ') || 'None'}</td></tr>)}</tbody></table></div>
+  </section>;
}
