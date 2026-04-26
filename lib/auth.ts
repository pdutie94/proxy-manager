import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export interface JWTPayload {
  sub: number;
  email: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function validateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    throw new Error('Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  return user;
}

export async function login(user: { id: number; email: string; role: string; name: string }): Promise<LoginResponse> {
  const payload: JWTPayload = { sub: user.id, email: user.email, role: user.role };
  
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRATION || '60m').toString().trim(),
  } as SignOptions);
  
  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
  } as SignOptions);

  // Save refresh token to database
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function refreshToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET) as unknown as JWTPayload;
    
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new Error('Invalid refresh token');
    }

    const newPayload: JWTPayload = { 
      sub: storedToken.user.id, 
      email: storedToken.user.email, 
      role: storedToken.user.role 
    };
    
    const accessToken = jwt.sign(newPayload, JWT_SECRET, {
      expiresIn: (process.env.JWT_ACCESS_EXPIRATION || '60m').toString().trim(),
    } as SignOptions);

    return { accessToken };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.delete({
    where: { token: refreshToken },
  });
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as JWTPayload;
  } catch (error) {
    throw new Error('Invalid access token');
  }
}
