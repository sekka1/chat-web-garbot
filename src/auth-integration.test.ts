/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Integration tests for the authentication flow
 *
 * Exercises the full HTTP lifecycle through the Express server:
 *   - Unauthenticated requests are rejected (401 / redirect)
 *   - Login with valid credentials returns a session cookie
 *   - Authenticated requests succeed
 *   - Logout clears the session
 *   - Post-logout requests are rejected again
 *
 * Uses supertest so no real server port is needed.
 * Mocks the Copilot SDK since we're testing auth, not AI.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import supertest from 'supertest';

// ---------- Environment setup (before importing server) ----------

const TEST_SECRET = 'integration-test-secret-for-auth-flow';
const TEST_DB_PATH = path.join(__dirname, '../data/test-auth-integration.db');

process.env.SESSION_SECRET = TEST_SECRET;
process.env.AUTH_DB_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

// Mock the Copilot SDK so the server can import without real auth
jest.mock('@github/copilot-sdk', () => ({
  CopilotClient: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    createSession: jest.fn().mockResolvedValue({
      sendAndWait: jest.fn().mockResolvedValue({
        data: { content: 'Mock AI response for auth integration test.' },
      }),
    }),
  })),
}));

// Now import auth modules and the app
import { getDb, closeDb } from './db.js';
import { hashPassword } from './auth-service.js';
import { app } from './server.js';

const TEST_EMAIL = 'integration@example.com';
const TEST_PASSWORD = 'my-secure-test-password';

/**
 * Mimics the client-side SHA-256 hash.
 */
function sha256(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

// ---------- Setup / Teardown ----------

beforeAll(async () => {
  // Clean slate
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Initialise DB + seed a test user
  const db = getDb();
  const clientHash = sha256(TEST_PASSWORD);
  const serverHash = await hashPassword(clientHash);
  db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(
    TEST_EMAIL,
    serverHash
  );
});

afterAll(() => {
  closeDb();
  // Clean up test database
  for (const ext of ['', '-wal', '-shm']) {
    const f = TEST_DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

// ---------- Helpers ----------

/**
 * Extracts the garbot_session cookie value from a supertest response.
 */
function getSessionCookie(res: supertest.Response): string | undefined {
  const raw = res.headers['set-cookie'];
  const cookies = (Array.isArray(raw) ? raw : [raw]) as string[];
  if (!cookies || cookies.length === 0) return undefined;
  const match = cookies
    .find((c: string) => c.startsWith('garbot_session='));
  if (!match) return undefined;
  return match.split(';')[0].split('=').slice(1).join('=');
}

// ---------- Tests ----------

describe('Auth integration flow', () => {
  let sessionCookie: string;

  it('GET / should redirect to /login.html when not authenticated', async () => {
    const res = await supertest(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login.html');
  });

  it('GET /api/auth/status should return 401 when not authenticated', async () => {
    const res = await supertest(app).get('/api/auth/status');
    expect(res.status).toBe(401);
    expect(res.body.authenticated).toBe(false);
  });

  it('POST /api/chat should return 401 when not authenticated', async () => {
    const res = await supertest(app)
      .post('/api/chat')
      .send({ message: 'hello' });
    expect(res.status).toBe(401);
  });

  it('POST /api/login should return 400 for missing fields', async () => {
    const res = await supertest(app)
      .post('/api/login')
      .send({ email: TEST_EMAIL });
    expect(res.status).toBe(400);
  });

  it('POST /api/login should return 400 for invalid email format', async () => {
    const res = await supertest(app)
      .post('/api/login')
      .send({ email: 'not-an-email', passwordHash: sha256('password') });
    expect(res.status).toBe(400);
  });

  it('POST /api/login should return 401 for wrong password', async () => {
    const res = await supertest(app)
      .post('/api/login')
      .send({ email: TEST_EMAIL, passwordHash: sha256('wrong-password') });
    expect(res.status).toBe(401);
  });

  it('POST /api/login should return 401 for non-existent user', async () => {
    const res = await supertest(app)
      .post('/api/login')
      .send({ email: 'nobody@example.com', passwordHash: sha256(TEST_PASSWORD) });
    expect(res.status).toBe(401);
  });

  it('POST /api/login should succeed with valid credentials and set cookie', async () => {
    const res = await supertest(app)
      .post('/api/login')
      .send({ email: TEST_EMAIL, passwordHash: sha256(TEST_PASSWORD) });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify cookie is set
    const cookie = getSessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie!.length).toBeGreaterThan(0);

    // Verify cookie attributes
    const rawCookies = res.headers['set-cookie'];
    const allCookies = (Array.isArray(rawCookies) ? rawCookies : [rawCookies]) as string[];
    const cookieHeader = allCookies
      .find((c: string) => c.startsWith('garbot_session='))!;
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Strict');
    expect(cookieHeader).toContain('Path=/');

    sessionCookie = cookie!;
  });

  it('GET /api/auth/status should return 200 with valid cookie', async () => {
    const res = await supertest(app)
      .get('/api/auth/status')
      .set('Cookie', `garbot_session=${sessionCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.email).toBe(TEST_EMAIL);
  });

  it('POST /api/login should be case-insensitive for email', async () => {
    const res = await supertest(app)
      .post('/api/login')
      .send({ email: TEST_EMAIL.toUpperCase(), passwordHash: sha256(TEST_PASSWORD) });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/logout should clear the session cookie', async () => {
    const res = await supertest(app)
      .post('/api/logout')
      .set('Cookie', `garbot_session=${sessionCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Cookie should be cleared (set to empty with past expiry)
    const rawCookies = res.headers['set-cookie'];
    const allCookies = (Array.isArray(rawCookies) ? rawCookies : [rawCookies]) as string[];
    const cookieHeader = allCookies
      .find((c: string) => c.startsWith('garbot_session='));
    expect(cookieHeader).toBeDefined();
  });

  it('GET /api/auth/status should return 401 after logout (no cookie)', async () => {
    const res = await supertest(app).get('/api/auth/status');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/status should return 401 with a tampered token', async () => {
    const res = await supertest(app)
      .get('/api/auth/status')
      .set('Cookie', 'garbot_session=this.is.not.a.valid.jwt');
    expect(res.status).toBe(401);
  });

  it('GET /api/health should be accessible without authentication', async () => {
    const res = await supertest(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /login.html should be accessible without authentication', async () => {
    const res = await supertest(app).get('/login.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
