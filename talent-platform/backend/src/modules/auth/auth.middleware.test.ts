import { describe, expect, it, vi } from 'vitest';
import { requireRoles } from './auth.middleware';

function responseMock() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

describe('authorization middleware', () => {
  it('allows an ADMIN through an ADMIN-only guard', () => {
    const next = vi.fn();
    const response = responseMock();
    requireRoles('ADMIN')({ user: { role: 'ADMIN' } } as never, response as never, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects a CANDIDATE from an ADMIN-only guard', () => {
    const next = vi.fn();
    const response = responseMock();
    requireRoles('ADMIN')({ user: { role: 'CANDIDATE' } } as never, response as never, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
