import bcrypt from 'bcrypt';
import { describe, expect, it, vi } from 'vitest';
import { loginUser, registerUser } from './auth.service';

const user = {
  id: 'user-1', email: 'candidate@example.com', passwordHash: '', firstName: 'Test', lastName: 'Candidate', role: 'CANDIDATE', active: true,
  createdAt: new Date(), updatedAt: new Date()
};

describe('authentication service', () => {
  it('registers a candidate with a hashed password and JWT', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 4);
    const prismaMock = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ ...user, passwordHash })
      }
    };
    const result = await registerUser(prismaMock as never, 'test-secret', { firstName: 'Test', lastName: 'Candidate', email: 'Candidate@Example.com', password: 'Password123!' });
    expect(result.user.role).toBe('CANDIDATE');
    expect(result.token.split('.')).toHaveLength(3);
    expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: 'candidate@example.com', passwordHash: expect.any(String) }) }));
  });

  it('logs in with a valid password and rejects an invalid password', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 4);
    const prismaMock = { user: { findUnique: vi.fn().mockResolvedValue({ ...user, passwordHash }) } };
    await expect(loginUser(prismaMock as never, 'test-secret', { email: user.email, password: 'Password123!' })).resolves.toMatchObject({ user: { id: 'user-1' }, token: expect.any(String) });
    await expect(loginUser(prismaMock as never, 'test-secret', { email: user.email, password: 'wrong-password' })).rejects.toThrow('Invalid email or password.');
  });
});
