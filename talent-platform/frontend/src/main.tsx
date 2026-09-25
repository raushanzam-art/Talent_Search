import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminShell } from './AdminShell';
import { QuestionAdminPage } from './QuestionAdminPage';
import { ResourceAdminPage } from './ResourceAdminPage';
import { CandidateAssessmentPage } from './CandidateAssessmentPage';
import { AssessmentResultsPage } from './AssessmentResultsPage';
import { AttemptAnswersReviewPage } from './AttemptAnswersReviewPage';
import { AdminAssessmentPage } from './AdminAssessmentPage';
import { CandidateLoginPage } from './CandidateLoginPage';
import { CandidateDashboardPage } from './CandidateDashboardPage';
import { QuestionTypeAdminPage } from './QuestionTypeAdminPage';
import { QuestionCategoryAdminPage } from './QuestionCategoryAdminPage';
import './styles.css';

function App() {
  const path = window.location.pathname;
  const assessmentMatch = path.match(/^\/assessment\/([^/]+)$/);
  if (assessmentMatch) return <CandidateAssessmentPage attemptId={assessmentMatch[1]} />;
  const resultsMatch = path.match(/^\/results\/([^/]+)$/);
  if (resultsMatch) return <AssessmentResultsPage attemptId={resultsMatch[1]} />;
  const reviewMatch = path.match(/^\/review\/([^/]+)$/);
  if (reviewMatch) return <AttemptAnswersReviewPage attemptId={reviewMatch[1]} />;
  if (path === '/login') return <CandidateLoginPage />;
  if (path === '/candidate') return <CandidateDashboardPage />;
  return <AdminShell>{(token) => path === '/admin/skills'
    ? <ResourceAdminPage kind="skills" token={token} />
    : path === '/admin/expertise-levels'
      ? <ResourceAdminPage kind="expertise-levels" token={token} />
      : path === '/admin/question-types'
        ? <QuestionTypeAdminPage token={token} />
        : path === '/admin/question-categories'
          ? <QuestionCategoryAdminPage token={token} />
      : path === '/admin/assessments'
        ? <AdminAssessmentPage token={token} />
      : <QuestionAdminPage token={token} />}</AdminShell>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
