import { FormEvent, useState } from 'react';
import { login } from './api';

export function CandidateLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError('');
    try {
      const result = await login(email, password);
      if (result.user.role !== 'CANDIDATE') throw new Error('Use the administrator sign-in for ADMIN accounts.');
      localStorage.setItem('talent_token', result.token);
      window.location.href = '/candidate';
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'Login failed.'); }
  }

  return <main className="page narrow-page"><p className="eyebrow">Talent Platform</p><h1>Candidate sign in</h1><form className="panel form-grid" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="error">{error}</p>}<button type="submit">Sign in</button></form></main>;
}
