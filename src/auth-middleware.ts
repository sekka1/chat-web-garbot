/**
 * Authentication middleware
 *
 * Reads the JWT from the `garbot_session` HTTP-only cookie and attaches
 * the decoded user payload to `req.user`. Returns 401 for unauthenticated
 * requests.
 *
 * Also exports a simple in-memory rate limiter for login attempts.
 *
 * @module auth-middleware
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from './auth-service.js';

/** Cookie name used for the session JWT */
export const SESSION_COOKIE = 'garbot_session';

/** Extend Express Request to include the authenticated user */
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

/**
 * Express middleware that requires a valid JWT in the session cookie.
 * On success, sets `req.user` and calls `next()`.
 * On failure, responds with 401.
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.user = payload;
  next();
}

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter for login attempts
// ---------------------------------------------------------------------------

interface RateBucket {
  count: number;
  resetAt: number;
}

/** Map of IP → rate bucket */
const loginAttempts = new Map<string, RateBucket>();

/** Max login attempts per window */
const MAX_ATTEMPTS = 10;

/** Window duration in milliseconds (15 minutes) */
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Rate-limit middleware for login endpoint.
 * Allows {@link MAX_ATTEMPTS} attempts per IP per {@link WINDOW_MS} window.
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function loginRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();

  const bucket = loginAttempts.get(ip);

  if (!bucket || now > bucket.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    return;
  }

  bucket.count += 1;
  next();
}
