import { useCallback, useEffect, useState } from 'react';
import { AssessmentResults, getAssessmentResults } from './api';

function formatSeconds(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

export function AssessmentResultsPage({ attemptId }: { attemptId: string }) {
  const [results, setResults] = useState<AssessmentResults | null>(null);
  const [error, setError] = useState('');
  const token = localStorage.getItem('talent_token') ?? localStorage.getItem('talent_admin_token') ?? '';

  const loadResults = useCallback(async () => {
    if (!token) {
      setError('Please sign in to view these results.');
      return;
    }
    try {
      setError('');
      setResults((await getAssessmentResults(token, attemptId)).data);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not load results.');
    }
  }, [attemptId, token]);

  useEffect(() => { void loadResults(); }, [loadResults]);

  if (error) return <main className="assessment-page"><section className="assessment-panel"><p className="error">{error}</p><button type="button" onClick={() => void loadResults()}>Try again</button></section></main>;
  if (!results) return <main className="assessment-page"><p>Loading results...</p></main>;

  return <main className="assessment-page">
    <section className="results-panel">
      <p className="eyebrow">Assessment results</p>
      <h1>{results.assessmentName}</h1>
      <div className="results-summary">
        <div><span>Score</span><strong>{results.score} / {results.maxScore}</strong></div>
        <div><span>Percentage</span><strong>{results.percentage.toFixed(2)}%</strong></div>
        <div><span>Questions answered</span><strong>{results.questionsAnswered} / {results.totalQuestions}</strong></div>
        <div><span>Questions timed out</span><strong>{results.questionsTimedOut}</strong></div>
      </div>
      {results.status === 'COMPLETED' && <a className="results-link" href={`/review/${attemptId}`}>Review my answers</a>}
      <section className="results-section"><h2>Time statistics</h2><dl className="results-stats"><div><dt>Total time</dt><dd>{formatSeconds(results.timeStatistics.totalSeconds)}</dd></div><div><dt>Average time</dt><dd>{formatSeconds(results.timeStatistics.averageSeconds)}</dd></div><div><dt>Fastest question</dt><dd>{results.timeStatistics.fastestSeconds === null ? '—' : formatSeconds(results.timeStatistics.fastestSeconds)}</dd></div><div><dt>Slowest question</dt><dd>{results.timeStatistics.slowestSeconds === null ? '—' : formatSeconds(results.timeStatistics.slowestSeconds)}</dd></div></dl></section>
      {results.skillResults.length > 0 && <section className="results-section"><h2>Skill results</h2><div className="table-wrap"><table><thead><tr><th>Skill</th><th>Score</th><th>Percentage</th><th>Answered</th><th>Timed out</th></tr></thead><tbody>{results.skillResults.map((skill) => <tr key={skill.skillId}><td>{skill.skillName}</td><td>{skill.score} / {skill.maxScore}</td><td>{skill.percentage.toFixed(2)}%</td><td>{skill.questionsAnswered}</td><td>{skill.questionsTimedOut}</td></tr>)}</tbody></table></div></section>}
    </section>
  </main>;
}
