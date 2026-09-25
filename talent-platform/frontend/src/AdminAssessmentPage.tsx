import { useEffect, useState } from 'react';
import { AdminAssessment, assignAssessment, CandidateSummary, createAdminAssessment, ExpertiseLevel, getAdminAssessments, getAdminCandidates, getExpertiseLevels, getQuestionCategories, getQuestionTypes, getQuestions, getSkills, Question, QuestionCategory, QuestionType, Skill } from './api';

export function AdminAssessmentPage({ token }: { token: string }) {
  const [assessments, setAssessments] = useState<AdminAssessment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([]);
  const [levels, setLevels] = useState<ExpertiseLevel[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [levelFilters, setLevelFilters] = useState<string[]>([]);
  const [skillFilters, setSkillFilters] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load(): Promise<void> {
    const [assessmentResult, questionResult, candidateResult, categoryResult, typeResult, levelResult, skillResult] = await Promise.all([
      getAdminAssessments(token), getQuestions(token), getAdminCandidates(token), getQuestionCategories(token), getQuestionTypes(token), getExpertiseLevels(token), getSkills(token)
    ]);
    setAssessments(assessmentResult.data); setQuestions(questionResult.data); setCandidates(candidateResult.data);
    setCategories(categoryResult.data); setQuestionTypes(typeResult.data); setLevels(levelResult.data); setSkills(skillResult.data);
  }
  useEffect(() => { void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load assessments.')); }, [token]);

  function categoryLabel(value: string): string {
    if (value === 'unassigned') return 'Unassigned';
    return categories.find((category) => category.id === value)?.name ?? value;
  }

  function levelLabel(value: string): string {
    return levels.find((level) => level.id === value)?.name ?? value;
  }

  function skillLabel(value: string): string {
    return skills.find((skill) => skill.id === value)?.name ?? value;
  }

  function selectedValues(event: { target: HTMLSelectElement }): string[] {
    return Array.from(event.target.selectedOptions, (option) => option.value);
  }

  const hasActiveFilters = categoryFilters.length > 0 || typeFilters.length > 0 || levelFilters.length > 0 || skillFilters.length > 0;

  function clearFilters(): void {
    setCategoryFilters([]);
    setTypeFilters([]);
    setLevelFilters([]);
    setSkillFilters([]);
  }

  const filteredQuestions = questions.filter((question) => {
    const categoryMatch = categoryFilters.length === 0 || categoryFilters.includes(question.category ? question.category.id : 'unassigned');
    const typeMatch = typeFilters.length === 0 || typeFilters.includes(question.type);
    const levelMatch = levelFilters.length === 0 || levelFilters.includes(question.expertiseLevel.id);
    const skillMatch = skillFilters.length === 0 || skillFilters.includes(question.skill.id);
    return categoryMatch && typeMatch && levelMatch && skillMatch;
  });

  function toggleQuestion(id: string): void {
    setSelectedQuestions((current) => current.includes(id) ? current.filter((questionId) => questionId !== id) : [...current, id]);
  }

  async function create(): Promise<void> {
    try { setError(''); await createAdminAssessment(token, { name, questionIds: selectedQuestions }); setName(''); setSelectedQuestions([]); setMessage('Assessment created.'); await load(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not create assessment.'); }
  }
  async function assign(): Promise<void> {
    try { setError(''); await assignAssessment(token, selectedAssessment, selectedCandidate); setMessage('Assessment assigned.'); await load(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not assign assessment.'); }
  }

  return <section>
    <div className="section-heading"><div><h2>Assessments</h2><p>Create assessments and grant candidate access.</p></div></div>
    {error && <p className="error">{error}</p>}
    {message && <p>{message}</p>}
    <section className="panel form-grid">
      <h3>Create assessment</h3>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <section className="panel filter-bar">
        <h3>Filter questions</h3>
        <div className="filter-controls">
          <label>Skill<select multiple size={4} value={skillFilters} onChange={(event) => setSkillFilters(selectedValues(event))}>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>
          <label>Category<select multiple size={4} value={categoryFilters} onChange={(event) => setCategoryFilters(selectedValues(event))}><option value="unassigned">Unassigned</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>Expertise level<select multiple size={4} value={levelFilters} onChange={(event) => setLevelFilters(selectedValues(event))}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
          <label>Question type<select multiple size={4} value={typeFilters} onChange={(event) => setTypeFilters(selectedValues(event))}>{questionTypes.map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}</select></label>
          <button type="button" className="secondary" onClick={clearFilters} disabled={!hasActiveFilters}>Clear filters</button>
        </div>
        {hasActiveFilters && <div className="active-filters">
          <span>Active filters:</span>
          {skillFilters.map((value) => <span className="filter-chip" key={`skill-${value}`}>{skillLabel(value)}<button type="button" onClick={() => setSkillFilters((current) => current.filter((item) => item !== value))} aria-label={`Remove skill filter ${skillLabel(value)}`}>×</button></span>)}
          {categoryFilters.map((value) => <span className="filter-chip" key={`category-${value}`}>{categoryLabel(value)}<button type="button" onClick={() => setCategoryFilters((current) => current.filter((item) => item !== value))} aria-label={`Remove category filter ${categoryLabel(value)}`}>×</button></span>)}
          {levelFilters.map((value) => <span className="filter-chip" key={`level-${value}`}>{levelLabel(value)}<button type="button" onClick={() => setLevelFilters((current) => current.filter((item) => item !== value))} aria-label={`Remove expertise level filter ${levelLabel(value)}`}>×</button></span>)}
          {typeFilters.map((value) => <span className="filter-chip" key={`type-${value}`}>{value}<button type="button" onClick={() => setTypeFilters((current) => current.filter((item) => item !== value))} aria-label={`Remove question type filter ${value}`}>×</button></span>)}
        </div>}
      </section>
      <label>Questions ({selectedQuestions.length} selected, {filteredQuestions.length} of {questions.length} shown)
        <div className="question-picker">
          {filteredQuestions.length === 0
            ? <p className="empty-state">No questions match the selected filters.</p>
            : filteredQuestions.map((question) => <label key={question.id} className="question-picker-row">
                <input type="checkbox" checked={selectedQuestions.includes(question.id)} onChange={() => toggleQuestion(question.id)} />
                <span>{question.questionCode} - {question.text} <em>({question.type} · {question.category?.name ?? 'Unassigned'} · {question.expertiseLevel.name} · {question.skill.name})</em></span>
              </label>)}
        </div>
      </label>
      <button type="button" onClick={() => void create()} disabled={!name || selectedQuestions.length === 0}>Create assessment</button>
    </section>
    <section className="panel form-grid">
      <h3>Assign assessment</h3>
      <label>Assessment<select value={selectedAssessment} onChange={(event) => setSelectedAssessment(event.target.value)}><option value="">Select assessment</option>{assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.name}</option>)}</select></label>
      <label>Candidate<select value={selectedCandidate} onChange={(event) => setSelectedCandidate(event.target.value)}><option value="">Select candidate</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.email}</option>)}</select></label>
      <button type="button" onClick={() => void assign()} disabled={!selectedAssessment || !selectedCandidate}>Assign access</button>
    </section>
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Questions</th><th>Assignments</th></tr></thead><tbody>{assessments.map((assessment) => <tr key={assessment.id}><td>{assessment.name}</td><td>{assessment.questionCount}</td><td>{assessment.assignments.length === 0 ? 'None' : <ul className="assignment-list">{assessment.assignments.map((assignment) => {
      const latestCompleted = assessment.attempts.filter((attempt) => attempt.userId === assignment.userId && attempt.status === 'COMPLETED').sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
      return <li key={assignment.id}>{assignment.user.email}{latestCompleted && <a href={`/review/${latestCompleted.id}`}>Review answers</a>}</li>;
    })}</ul>}</td></tr>)}</tbody></table></div>
  </section>;
}
