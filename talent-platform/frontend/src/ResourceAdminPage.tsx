import { FormEvent, useEffect, useState } from 'react';
import { deleteExpertiseLevel, deleteSkill, ExpertiseLevel, getExpertiseLevels, getSkills, saveExpertiseLevel, saveSkill, Skill } from './api';

type ResourceKind = 'skills' | 'expertise-levels';

export function ResourceAdminPage({ token, kind }: { token: string; kind: ResourceKind }) {
  const isSkills = kind === 'skills';
  const [items, setItems] = useState<Array<Skill | ExpertiseLevel>>([]);
  const [editingId, setEditingId] = useState<string>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [seconds, setSeconds] = useState(20);
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  async function load(): Promise<void> {
    const result = isSkills ? await getSkills(token) : await getExpertiseLevels(token);
    setItems(result.data);
  }
  useEffect(() => { load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load records.')); }, [token, isSkills]);

  function reset(): void { setEditingId(undefined); setName(''); setDescription(''); setSeconds(20); setActive(true); }
  function edit(item: Skill | ExpertiseLevel): void { setEditingId(item.id); setName(item.name); setActive(item.active); if (isSkills) setDescription((item as Skill).description ?? ''); else setSeconds((item as ExpertiseLevel).secondsPerQuestion); }
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError('');
    try { if (isSkills) await saveSkill(token, { name, description, active }, editingId); else await saveExpertiseLevel(token, { name, secondsPerQuestion: seconds, active }, editingId); reset(); await load(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not save record.'); }
  }
  async function remove(id: string): Promise<void> {
    if (!window.confirm(`Delete this ${isSkills ? 'skill' : 'expertise level'}?`)) return;
    try { if (isSkills) await deleteSkill(token, id); else await deleteExpertiseLevel(token, id); await load(); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Could not delete record.'); }
  }

  return <section>
    <div className="section-heading"><div><h2>{isSkills ? 'Skills' : 'Expertise levels'}</h2><p>Manage reusable question metadata.</p></div><button type="button" onClick={reset}>New {isSkills ? 'skill' : 'level'}</button></div>
    {error && <p className="error">{error}</p>}
    <form className="panel form-grid compact-form" onSubmit={submit}>
      <h3>{editingId ? 'Edit record' : 'Create record'}</h3>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
      {isSkills ? <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label> : <label>Seconds per question<input type="number" min="1" value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} required /></label>}
      <label className="checkbox-label"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>
      <div><button type="submit">{editingId ? 'Save changes' : 'Create'}</button>{editingId && <button type="button" className="secondary" onClick={reset}>Cancel</button>}</div>
    </form>
    <div className="table-wrap"><table><thead><tr><th>Name</th>{isSkills ? <th>Description</th> : <th>Seconds per question</th>}<th>Active</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td>{isSkills ? <td>{(item as Skill).description}</td> : <td>{(item as ExpertiseLevel).secondsPerQuestion}</td>}<td>{item.active ? 'Yes' : 'No'}</td><td><button type="button" onClick={() => edit(item)}>Edit</button> <button type="button" className="danger" onClick={() => remove(item.id)}>Delete</button></td></tr>)}</tbody></table></div>
  </section>;
}
