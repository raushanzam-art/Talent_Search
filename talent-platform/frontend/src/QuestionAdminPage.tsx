import { FormEvent, useEffect, useState } from 'react';
import { deleteQuestion, getExpertiseLevels, getQuestionCategories, getQuestionTypes, getQuestions, getSkills, importQuestionCsv, Question, QuestionCategory, QuestionImportReport, QuestionType, saveQuestion, Skill, ExpertiseLevel } from './api';

const emptyQuestion = {
  questionCode: '', text: '', skillId: '', expertiseLevelId: '', categoryId: '', type: 'MULTIPLE_CHOICE', difficulty: 'Easy', language: 'en', explanation: '', active: true,
  options: [{ optionText: '', score: 1, isCorrect: false }, { optionText: '', score: 2, isCorrect: false }, { optionText: '', score: 3, isCorrect: true }]
};

export function QuestionAdminPage({ token }: { token: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [levels, setLevels] = useState<ExpertiseLevel[]>([]);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [levelFilters, setLevelFilters] = useState<string[]>([]);
  const [form, setForm] = useState(emptyQuestion);
  const [editingId, setEditingId] = useState<string>();
  const [error, setError] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<QuestionImportReport | null>(null);
  const [importing, setImporting] = useState(false);

  async function load(): Promise<void> {
    const [questionResult, skillResult, levelResult, typeResult, categoryResult] = await Promise.all([getQuestions(token), getSkills(token), getExpertiseLevels(token), getQuestionTypes(token), getQuestionCategories(token)]);
    setQuestions(questionResult.data); setSkills(skillResult.data); setLevels(levelResult.data); setQuestionTypes(typeResult.data); setCategories(categoryResult.data);
  }
  useEffect(() => { load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load questions.')); }, [token]);

  function updateOption(index: number, field: 'optionText' | 'score' | 'isCorrect', value: string | boolean): void {
    setForm((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, [field]: field === 'score' ? Number(value) : value } : option) }));
  }

  function addOption(): void {
    setForm((current) => current.options.length >= 5 ? current : { ...current, options: [...current.options, { optionText: '', score: current.options.length + 1, isCorrect: false }] });
  }

  function removeLastOption(): void {
    setForm((current) => current.options.length <= 3 ? current : { ...current, options: current.options.slice(0, -1) });
  }

  function edit(question: Question): void {
    setEditingId(question.id);
    setForm({ questionCode: question.questionCode, text: question.text, skillId: question.skill.id, expertiseLevelId: question.expertiseLevel.id, categoryId: question.category?.id ?? '', type: question.type, difficulty: question.difficulty, language: question.language, explanation: question.explanation ?? '', active: question.active, options: question.options.map((option) => ({ optionText: option.optionText, score: option.score ?? 1, isCorrect: option.isCorrect ?? false })) });
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError('');
    try { await saveQuestion(token, form, editingId); setForm(emptyQuestion); setEditingId(undefined); await load(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not save question.'); }
  }

  async function remove(id: string): Promise<void> {
    if (!window.confirm('Delete this question?')) return;
    try { await deleteQuestion(token, id); await load(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not delete question.'); }
  }

  async function validateCsv(): Promise<void> {
    if (!csvFile) return;
    setError(''); setImportReport(null); setImporting(true);
    try { setImportReport((await importQuestionCsv(token, csvFile, 'validate')).data); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not validate CSV.'); } finally { setImporting(false); }
  }

  async function importCsv(): Promise<void> {
    if (!csvFile || !importReport || importReport.invalidRows > 0) return;
    setError(''); setImporting(true);
    try { setImportReport((await importQuestionCsv(token, csvFile, 'import')).data); await load(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not import CSV.'); } finally { setImporting(false); }
  }

  function categoryLabel(value: string): string {
    if (value === 'unassigned') return 'Unassigned';
    return categories.find((category) => category.id === value)?.name ?? value;
  }

  function levelLabel(value: string): string {
    return levels.find((level) => level.id === value)?.name ?? value;
  }

  function selectedValues(event: { target: HTMLSelectElement }): string[] {
    return Array.from(event.target.selectedOptions, (option) => option.value);
  }

  const hasActiveFilters = categoryFilters.length > 0 || typeFilters.length > 0 || levelFilters.length > 0;

  function clearFilters(): void {
    setCategoryFilters([]);
    setTypeFilters([]);
    setLevelFilters([]);
  }

  const filteredQuestions = questions.filter((question) => {
    const categoryMatch = categoryFilters.length === 0 || categoryFilters.includes(question.category ? question.category.id : 'unassigned');
    const typeMatch = typeFilters.length === 0 || typeFilters.includes(question.type);
    const levelMatch = levelFilters.length === 0 || levelFilters.includes(question.expertiseLevel.id);
    return categoryMatch && typeMatch && levelMatch;
  });

  async function toggleActive(question: Question): Promise<void> {
    try {
      await saveQuestion(token, {
        questionCode: question.questionCode,
        text: question.text,
        skillId: question.skill.id,
        expertiseLevelId: question.expertiseLevel.id,
        categoryId: question.category?.id,
        type: question.type,
        difficulty: question.difficulty,
        language: question.language,
        explanation: question.explanation ?? '',
        active: !question.active,
        options: question.options
      }, question.id);
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not update question status.');
    }
  }

  return <section>
    <div className="section-heading"><div><h2>Questions</h2><p>Manage assessment question content.</p></div><button type="button" onClick={() => { setForm(emptyQuestion); setEditingId(undefined); }}>New question</button></div>
    {error && <p className="error">{error}</p>}
    <section className="panel csv-import-panel">
      <h3>Import questions from CSV</h3>
      <div className="csv-controls"><input type="file" accept=".csv,text/csv" onChange={(event) => { setCsvFile(event.target.files?.[0] ?? null); setImportReport(null); }} /><button type="button" onClick={() => void validateCsv()} disabled={!csvFile || importing}>Validate</button><button type="button" onClick={() => void importCsv()} disabled={!csvFile || !importReport || importReport.invalidRows > 0 || importing}>Import</button></div>
      {importReport && <><p>{importReport.mode === 'import' ? 'Import result' : 'Validation result'}: {importReport.validRows} valid, {importReport.invalidRows} invalid, {importReport.duplicateRows} duplicates, {importReport.importedRows} imported.</p><div className="table-wrap"><table><thead><tr><th>Row</th><th>Code</th><th>Skill</th><th>Level</th><th>Type</th><th>Status</th></tr></thead><tbody>{importReport.preview.map((row) => <tr key={row.row}><td>{row.row}</td><td>{row.questionCode}</td><td>{row.skill}</td><td>{row.level}</td><td>{row.type}</td><td>{row.valid ? 'Valid' : row.errors.join(' ')}</td></tr>)}</tbody></table></div></>}
    </section>
    <form className="panel form-grid question-form" onSubmit={submit}>
      <h3>{editingId ? 'Edit question' : 'Create question'}</h3>
      <label>Question code<input value={form.questionCode} onChange={(event) => setForm({ ...form, questionCode: event.target.value })} required /></label>
      <label>Question text<textarea value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} required /></label>
      <label>Skill<select value={form.skillId} onChange={(event) => setForm({ ...form, skillId: event.target.value })} required><option value="">Select skill</option>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>
      <label>Expertise level<select value={form.expertiseLevelId} onChange={(event) => setForm({ ...form, expertiseLevelId: event.target.value })} required><option value="">Select level</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
      <label>Question category<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Unassigned</option>{categories.filter((category) => category.active || category.id === form.categoryId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{questionTypes.filter((type) => type.active || type.name === form.type).map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}</select></label>
      <label>Difficulty<select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}>{['Easy', 'Medium', 'Hard'].map((difficulty) => <option key={difficulty}>{difficulty}</option>)}</select></label>
      <label>Language<input value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} required /></label>
      <p className="option-row-actions field-hint">The correct option must have a strictly higher score than every other option. Wrong options don't need to differ from each other &mdash; e.g. simple right/wrong marking (correct = 1, wrong = 0) is fine, as is a partial-credit ranking.</p>
      {form.options.map((option, index) => <div className="option-row" key={index}>
        <label>Option {index + 1} {index < 3 ? <em>(required)</em> : <em>(optional)</em>}<input value={option.optionText} onChange={(event) => updateOption(index, 'optionText', event.target.value)} required /></label>
        <label>Score<input type="number" min="0" max="100" value={option.score} onChange={(event) => updateOption(index, 'score', event.target.value)} required /></label>
        <label>Correct<input type="checkbox" checked={option.isCorrect} onChange={(event) => updateOption(index, 'isCorrect', event.target.checked)} /></label>
        {index >= 3 && index === form.options.length - 1 && <button type="button" className="secondary" onClick={removeLastOption}>Remove option {index + 1}</button>}
      </div>)}
      {form.options.length < 5 && <div className="option-row-actions"><button type="button" className="secondary" onClick={addOption}>Add option {form.options.length + 1} (optional)</button></div>}
      <label>Explanation<textarea value={form.explanation} onChange={(event) => setForm({ ...form, explanation: event.target.value })} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
      <div><button type="submit">{editingId ? 'Save changes' : 'Create question'}</button>{editingId && <button type="button" className="secondary" onClick={() => { setForm(emptyQuestion); setEditingId(undefined); }}>Cancel</button>}</div>
    </form>
    <section className="panel filter-bar">
      <h3>Filter questions</h3>
      <div className="filter-controls">
        <label>Category<select multiple size={4} value={categoryFilters} onChange={(event) => setCategoryFilters(selectedValues(event))}><option value="unassigned">Unassigned</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Question type<select multiple size={4} value={typeFilters} onChange={(event) => setTypeFilters(selectedValues(event))}>{questionTypes.map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}</select></label>
        <label>Expertise level<select multiple size={4} value={levelFilters} onChange={(event) => setLevelFilters(selectedValues(event))}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
        <button type="button" className="secondary" onClick={clearFilters} disabled={!hasActiveFilters}>Clear filters</button>
      </div>
      {hasActiveFilters && <div className="active-filters">
        <span>Active filters:</span>
        {categoryFilters.map((value) => <span className="filter-chip" key={`category-${value}`}>{categoryLabel(value)}<button type="button" onClick={() => setCategoryFilters((current) => current.filter((item) => item !== value))} aria-label={`Remove category filter ${categoryLabel(value)}`}>×</button></span>)}
        {typeFilters.map((value) => <span className="filter-chip" key={`type-${value}`}>{value}<button type="button" onClick={() => setTypeFilters((current) => current.filter((item) => item !== value))} aria-label={`Remove question type filter ${value}`}>×</button></span>)}
        {levelFilters.map((value) => <span className="filter-chip" key={`level-${value}`}>{levelLabel(value)}<button type="button" onClick={() => setLevelFilters((current) => current.filter((item) => item !== value))} aria-label={`Remove expertise level filter ${levelLabel(value)}`}>×</button></span>)}
      </div>}
    </section>
    <div className="table-wrap"><table><thead><tr><th>Code</th><th>Question</th><th>Type</th><th>Category</th><th>Subject</th><th>Year group</th><th>Difficulty</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredQuestions.length === 0 ? <tr><td colSpan={9} className="empty-state">No questions match the selected filters.</td></tr> : filteredQuestions.map((question) => <tr key={question.id}><td>{question.questionCode}</td><td>{question.text}</td><td>{question.type}</td><td>{question.category?.name ?? 'Unassigned'}</td><td>{question.skill.name}</td><td>{question.expertiseLevel.name}</td><td>{question.difficulty}</td><td>{question.active ? 'Active' : 'Inactive'}</td><td><button type="button" onClick={() => edit(question)}>Edit</button> <button type="button" onClick={() => toggleActive(question)}>{question.active ? 'Deactivate' : 'Activate'}</button> <button type="button" className="danger" onClick={() => remove(question.id)}>Delete</button></td></tr>)}</tbody></table></div>
  </section>;
}
