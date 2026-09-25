import { useCallback, useEffect, useState } from 'react';
import { AttemptAnswerStatus, AttemptAnswersReport, getAttemptAnswers } from './api';

const statusLabels: Record<AttemptAnswerStatus, string> = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  timedOut: 'Timed out',
  unanswered: 'Unanswered'
};

function questionStatus(question: AttemptAnswersReport['questions'][number]): AttemptAnswerStatus {
  if (question.isTimedOut) return 'timedOut';
  if (!question.candidateAnswer) return 'unanswered';
  return question.isCorrect ? 'correct' : 'incorrect';
}

function formatSeconds(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

export function AttemptAnswersReviewPage({ attemptId }: { attemptId: string }) {
  const [report, setReport] = useState<AttemptAnswersReport | null>(null);
  const [statusFilter, setStatusFilter] = useState<AttemptAnswerStatus | ''>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = localStorage.getItem('talent_token') ?? localStorage.getItem('talent_admin_token') ?? '';

  const load = useCallback(async () => {
    if (!token) {
      setError('Please sign in to review these answers.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setError('');
      const result = await getAttemptAnswers(token, attemptId, { status: statusFilter || undefined, page, pageSize: 10 });
      setReport(result.data);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not load the answer review.');
    } finally {
      setLoading(false);
    }
  }, [attemptId, token, statusFilter, page]);

  useEffect(() => { void load(); }, [load]);

  function changeStatusFilter(value: string): void {
    setStatusFilter(value as AttemptAnswerStatus | '');
    setPage(1);
  }

  if (error) return <main className="assessment-page"><section className="assessment-panel"><p className="error">{error}</p><button type="button" onClick={() => void load()}>Try again</button></section></main>;
  if (loading && !report) return <main className="assessment-page"><p>Loading answer review...</p></main>;
  if (!report) return null;

  return <main className="assessment-page">
    <section className="results-panel review-panel">
      <p className="eyebrow">Answer review</p>
      <h1>{report.assessmentName}</h1>
      <div className="results-summary">
        <div><span>Score</span><strong>{report.score} / {report.maxScore}</strong></div>
        <div><span>Percentage</span><strong>{report.percentage.toFixed(2)}%</strong></div>
        <div><span>Total questions</span><strong>{report.totalQuestions}</strong></div>
        <div><span>Matching filter</span><strong>{report.matchingQuestions}</strong></div>
      </div>
      <a className="results-link" href={`/results/${attemptId}`}>Back to results summary</a>

      <div className="review-controls">
        <label>Filter by status
          <select value={statusFilter} onChange={(event) => changeStatusFilter(event.target.value)}>
            <option value="">All questions</option>
            <option value="correct">Correct</option>
            <option value="incorrect">Incorrect</option>
            <option value="timedOut">Timed out</option>
            <option value="unanswered">Unanswered</option>
          </select>
        </label>
      </div>

      {report.questions.length === 0
        ? <p className="empty-state">No questions match this filter.</p>
        : <div className="review-questions">{report.questions.map((question) => {
            const status = questionStatus(question);
            return <article className={`review-question review-question-${status}`} key={question.questionId}>
              <header className="review-question-header">
                <span>Question {question.position} of {report.totalQuestions}</span>
                <span className={`review-status-badge review-status-${status}`}>{statusLabels[status]}</span>
              </header>
              <h2>{question.text}</h2>
              <ul className="review-options">
                {question.options.map((option) => {
                  const isCorrectOption = option.id === question.correctAnswer.optionId;
                  const isCandidateOption = question.candidateAnswer?.optionId === option.id;
                  const tag = isCorrectOption && isCandidateOption ? 'Your answer — correct' : isCorrectOption ? 'Correct answer' : isCandidateOption ? 'Your answer' : null;
                  return <li key={option.id} className={`review-option${isCorrectOption ? ' review-option-correct' : ''}${isCandidateOption && !isCorrectOption ? ' review-option-chosen-wrong' : ''}`}>
                    <span>{option.optionText}</span>
                    {tag && <em>{tag}</em>}
                  </li>;
                })}
              </ul>
              {!question.candidateAnswer && <p className="review-no-answer">{question.isTimedOut ? 'No answer submitted — time expired.' : 'No answer submitted.'}</p>}
              {question.explanation && <p className="review-explanation"><strong>Explanation:</strong> {question.explanation}</p>}
              <p className="review-meta">{question.skill.name} &middot; {question.difficulty} &middot; {formatSeconds(question.timeSpent)} spent of {formatSeconds(question.allowedSeconds)} allowed</p>
            </article>;
          })}</div>}

      {report.totalPages > 1 && <div className="review-pagination">
        <button type="button" className="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={report.page <= 1}>Previous</button>
        <span>Page {report.page} of {report.totalPages}</span>
        <button type="button" className="secondary" onClick={() => setPage((current) => Math.min(report.totalPages, current + 1))} disabled={report.page >= report.totalPages}>Next</button>
      </div>}
    </section>
  </main>;
}
