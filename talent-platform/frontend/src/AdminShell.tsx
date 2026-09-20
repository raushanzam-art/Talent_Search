import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { AuthUser, getMe, login } from './api';

interface AdminShellProps {
  children: (token: string) => ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [token, setToken] = useState(() => localStorage.getItem('talent_admin_token') ?? '');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then(({ user: authenticatedUser }) => {
        if (authenticatedUser.role !== 'ADMIN') throw new Error('This is an administrator page. Sign in with an ADMIN account.');
        setUser(authenticatedUser);
      })
      .catch((reason: unknown) => {
        localStorage.removeItem('talent_admin_token');
        setToken('');
        setError(reason instanceof Error ? reason.message : 'Authentication failed.');
      })
      .finally(() => setChecking(false));
  }, [token]);

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    try {
      const result = await login(email, password);
      if (result.user.role !== 'ADMIN') throw new Error('This is an administrator page. Sign in with an ADMIN account.');
      localStorage.setItem('talent_admin_token', result.token);
      setToken(result.token);
      setUser(result.user);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Login failed.');
    }
  }

  function logout(): void {
    localStorage.removeItem('talent_admin_token');
    setToken('');
    setUser(null);
  }

  if (checking) return <main className="page"><p>Checking authentication...</p></main>;
  if (!user) {
    return (
      <main className="page narrow-page">
        <p className="eyebrow">Talent Platform Admin</p>
        <h1>Sign in</h1>
        <form className="panel form-grid" onSubmit={handleLogin}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Sign in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div><p className="eyebrow">Talent Platform Admin</p><h1>Content management</h1></div>
        <div className="user-actions"><span>{user.email}</span><button type="button" onClick={logout}>Sign out</button></div>
      </header>
      <nav className="nav-links">
        <a href="/admin/questions">Questions</a>
        <a href="/admin/skills">Skills</a>
        <a href="/admin/expertise-levels">Expertise levels</a>
        <a href="/admin/assessments">Assessments</a>
      </nav>
      {children(token)}
    </main>
  );
}
