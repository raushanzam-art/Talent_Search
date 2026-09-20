import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { LoginInput, RegisterInput, UserRole } from './auth.validation';

const passwordSaltRounds = 12;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  active: boolean;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email is already registered.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsError';
  }
}

export class InactiveUserError extends Error {
  constructor() {
    super('User account is inactive.');
    this.name = 'InactiveUserError';
  }
}

interface TokenClaims extends JwtPayload {
  sub: string;
  role: UserRole;
}

function toAuthUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as UserRole,
    active: user.active
  };
}

function createToken(user: AuthUser, jwtSecret: string): string {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: '1h' });
}

export async function registerUser(
  prisma: PrismaClient,
  jwtSecret: string,
  input: RegisterInput
): Promise<AuthResult> {
  const email = input.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await bcrypt.hash(input.password, passwordSaltRounds);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: 'CANDIDATE'
    }
  });
  const authUser = toAuthUser(user);

  return { user: authUser, token: createToken(authUser, jwtSecret) };
}

export async function loginUser(
  prisma: PrismaClient,
  jwtSecret: string,
  input: LoginInput
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new InvalidCredentialsError();
  }
  if (!user.active) {
    throw new InactiveUserError();
  }

  const authUser = toAuthUser(user);
  return { user: authUser, token: createToken(authUser, jwtSecret) };
}

export async function getUserById(prisma: PrismaClient, id: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.active) {
    throw new InvalidCredentialsError();
  }
  return toAuthUser(user);
}

export function verifyToken(token: string, jwtSecret: string): TokenClaims {
  const payload = jwt.verify(token, jwtSecret);
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !payload.role) {
    throw new InvalidCredentialsError();
  }
  return payload as TokenClaims;
}
