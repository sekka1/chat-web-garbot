/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Unit tests for the authentication layer
 *
 * Tests cover:
 *  - Password hashing (hashPassword)
 *  - Login verification (verifyLogin)
 *  - JWT creation and validation (verifyToken)
 *  - requireAuth middleware
 *  - loginRateLimiter middleware
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';

// ---------- Environment setup (must come before importing auth modules) ----------

const TEST_SECRET = 'test-secret-key-for-unit-tests-only';
const TEST_DB_PATH = path.join(__dirname, '../data/test-auth.db');

// Set env vars before importing modules that read them at load time
process.env.SESSION_SECRET = TEST_SECRET;
process.env.AUTH_DB_PATH = TEST_DB_PATH;

// Now import auth modules
import { verifyLogin, verifyToken, hashPassword } from './auth-service.js';
import { requireAuth, loginRateLimiter } from './auth-middleware.js';
import { closeDb, getDb } from './db.js';

// ---------- Helpers ----------

/**
 * Mimics the client-side SHA-256 hash.
 */
function sha256(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

/**
 * Creates a mock Express request with optional overrides.
 */
function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    cookies: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

/**
 * Creates a mock Express response that captures status codes and JSON bodies.
 */
function mockResponse(): Response & { _status: number; _json: unknown; _headers: Record<string, string> } {
  const res: { _status: number; _json: unknown; _headers: Record<string, string>; status: (code: number) => typeof res; json: (body: unknown) => typeof res; setHeader: (name: string, value: string) => typeof res } = {
    _status: 200,
    _json: null as unknown,
    _headers: {} as Record<string, string>,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._json = body;
      return res;
    },
    setHeader(name: string, value: string) {
      res._headers[name] = value;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _json: unknown; _headers: Record<string, string> };
}

// ---------- Setup / Teardown ----------

beforeAll(async () => {
  // Ensure clean database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Initialise DB + seed one test user
  const db = getDb();
  const clientHash = sha256('test-password-123');
  const serverHash = await hashPassword(clientHash);
  db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(
    'test@example.com',
    serverHash
  );
});

afterAll(() => {
  closeDb();
  // Clean up test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  const walPath = TEST_DB_PATH + '-wal';
  const shmPath = TEST_DB_PATH + '-shm';
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
});

// ---------- Tests ----------

describe('hashPassword', () => {
  it('should return an argon2 hash string', async () => {
    const hash = await hashPassword('some-sha256-hex');
    expect(hash).toMatch(/^\$argon2/);
  });

  it('should produce different hashes for the same input (random salt)', async () => {
    const hash1 = await hashPassword('same-input');
    const hash2 = await hashPassword('same-input');
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyLogin', () => {
  it('should return a JWT for valid credentials', async () => {
    const clientHash = sha256('test-password-123');
    const token = await verifyLogin('test@example.com', clientHash);

    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
  });

  it('should return null for wrong password', async () => {
    const clientHash = sha256('wrong-password');
    const token = await verifyLogin('test@example.com', clientHash);

    expect(token).toBeNull();
  });

  it('should return null for non-existent user', async () => {
    const clientHash = sha256('any-password');
    const token = await verifyLogin('nobody@example.com', clientHash);

    expect(token).toBeNull();
  });

  it('should be case-insensitive for email', async () => {
    const clientHash = sha256('test-password-123');
    const token = await verifyLogin('TEST@EXAMPLE.COM', clientHash);

    expect(token).toBeTruthy();
  });
});

describe('verifyToken', () => {
  it('should decode a valid token', async () => {
    const clientHash = sha256('test-password-123');
    const token = await verifyLogin('test@example.com', clientHash);

    expect(token).not.toBeNull();
    const payload = verifyToken(token!);

    expect(payload).not.toBeNull();
    expect(payload!.email).toBe('test@example.com');
    expect(payload!.userId).toBeDefined();
  });

  it('should return null for an invalid token', () => {
    const payload = verifyToken('not-a-real-token');
    expect(payload).toBeNull();
  });

  it('should return null for an empty string', () => {
    const payload = verifyToken('');
    expect(payload).toBeNull();
  });
});

describe('requireAuth middleware', () => {
  it('should return 401 when no cookie is present', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for an invalid token', () => {
    const req = mockRequest({ cookies: { garbot_session: 'bad-token' } });
    const res = mockResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() and set req.user for a valid token', async () => {
    const clientHash = sha256('test-password-123');
    const token = await verifyLogin('test@example.com', clientHash);

    const req = mockRequest({ cookies: { garbot_session: token! } });
    const res = mockResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.email).toBe('test@example.com');
  });
});

describe('loginRateLimiter middleware', () => {
  it('should allow requests under the limit', () => {
    const req = mockRequest({ ip: '192.168.1.100' });
    const res = mockResponse();
    const next = jest.fn();

    loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._status).toBe(200);
  });

  it('should block after too many attempts', () => {
    const ip = '10.0.0.99';
    let next: jest.Mock;
    let res: ReturnType<typeof mockResponse>;

    // Make 10 requests (the limit)
    for (let i = 0; i < 10; i++) {
      const req = mockRequest({ ip });
      res = mockResponse();
      next = jest.fn();
      loginRateLimiter(req, res, next);
    }

    // 11th should be blocked
    const req = mockRequest({ ip });
    res = mockResponse();
    next = jest.fn();
    loginRateLimiter(req, res, next);

    expect(res._status).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });
});
