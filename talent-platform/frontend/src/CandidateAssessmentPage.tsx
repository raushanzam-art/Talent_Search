import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, CurrentAttempt, getCurrentAttempt, submitAnswer } from './api';
import { AssessmentTimer } from './AssessmentTimer';

export function CandidateAssessmentPage({ attemptId }: { attemptId: string }) {
  const [attempt, setAttempt] = useState<CurrentAttempt | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('talent_token') ?? localStorage.getItem('talent_admin_token') ?? '';

  const loadCurrent = useCallback(async () => {
    if (!token) {
      setError('Please sign in before starting an assessment.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const result = await getCurrentAttempt(token, attemptId);
      setAttempt(result.data);
      setSelectedOptionId('');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not load the assessment.');
    } finally {
      setLoading(false);
    }
  }, [attemptId, token]);

  useEffect(() => { void loadCurrent(); }, [loadCurrent]);
  useEffect(() => { setHasTimedOut(false); }, [attempt?.question?.id]);
  const handleTimerExpired = useCallback(() => setHasTimedOut(true), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!attempt?.question || (!selectedOptionId && !hasTimedOut) || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await submitAnswer(token, attemptId, attempt.question.id, selectedOptionId);
      setAttempt((current) => current ? {
        ...current,
        status: result.data.nextQuestion ? 'IN_PROGRESS' : 'COMPLETED',
        questionNumber: result.data.nextQuestion ? (current.questionNumber ?? 0) + 1 : null,
        question: result.data.nextQuestion,
        questionStartedAt: result.data.nextQuestionStartedAt,
        allowedSeconds: result.data.allowedSeconds
      } : current);
      setSelectedOptionId('');
    } catch (reason: unknown) {
      if (reason instanceof ApiError && reason.status === 408) {
        setError('Time expired. Loading the current server state.');
        await loadCurrent();
      } else {
        setError(reason instanceof Error ? reason.message : 'Could not submit your answer.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="assessment-page"><p>Loading assessment...</p></main>;
  if (error && !attempt) return <main className="assessment-page"><p className="error">{error}</p><button type="button" onClick={() => { setLoading(true); void loadCurrent(); }}>Try again</button></main>;
  if (!attempt) return null;
  if (attempt.status === 'COMPLETED' || !attempt.question) {
    return <main className="assessment-page"><section className="assessment-panel"><p className="eyebrow">Assessment complete</p><h1>Thank you.</h1><p>Your answers have been submitted.</p><a className="results-link" href={`/results/${attemptId}`}>View results</a></section></main>;
  }

  return <main className="assessment-page">
    <section className="assessment-panel" aria-live="polite">
      <div className="assessment-meta"><span>Question {attempt.questionNumber} of {attempt.totalQuestions}</span><span>Time Remaining: <AssessmentTimer key={attempt.question.id} questionStartedAt={attempt.questionStartedAt ?? ''} allowedSeconds={attempt.allowedSeconds ?? 0} onDisplayExpired={handleTimerExpired} /></span></div>
      <h1>{attempt.question.text}</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <fieldset className="answer-options">
          <legend>Select an answer</legend>
          {attempt.question.options.map((option) => <label className="answer-option" key={option.id}><input type="radio" name="answer" value={option.id} checked={selectedOptionId === option.id} onChange={() => setSelectedOptionId(option.id)} /><span>{option.optionText}</span></label>)}
        </fieldset>
        <button type="submit" disabled={(!selectedOptionId && !hasTimedOut) || submitting}>{submitting ? 'Submitting...' : 'Next'}</button>
      </form>
    </section>
  </main>;
}
