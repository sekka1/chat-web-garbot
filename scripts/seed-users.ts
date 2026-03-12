/**
 * Seed script — creates initial users in the auth database.
 *
 * Generates a random password for each user, hashes it the same way
 * the client + server would (SHA-256 → argon2), inserts into the DB,
 * and prints the plaintext passwords to stdout so the admin can save them.
 *
 * Usage:
 *   npx tsx scripts/seed-users.ts
 *
 * Environment:
 *   AUTH_DB_PATH — optional, defaults to ./data/auth.db
 *
 * @module seed-users
 */

import crypto from 'crypto';
import argon2 from 'argon2';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Users to seed */
const SEED_USERS = [
  { email: 'ci-system@gmail.com', role: 'CI system' },
  { email: 'garlandk@gmail.com', role: 'Regular user' },
];

/**
 * Generates a cryptographically random password.
 * @param length - Password length (default 20)
 * @returns A random alphanumeric password string
 */
function generatePassword(length = 20): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

/**
 * Mimics the client-side SHA-256 hash step.
 * @param plaintext - The raw password string
 * @returns Hex-encoded SHA-256 digest
 */
function sha256(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

async function main(): Promise<void> {
  const dbPath = process.env.AUTH_DB_PATH || path.join(__dirname, '../data/auth.db');

  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create users table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, ?)
  `);

  console.log('');
  console.log('='.repeat(60));
  console.log('  Garbot Chat — User Seed');
  console.log('='.repeat(60));
  console.log('');

  let seeded = 0;

  for (const user of SEED_USERS) {
    // Check if user already exists
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(user.email) as { id: number } | undefined;

    if (existing) {
      console.log(`  ⏭  ${user.email} (${user.role}) — already exists, skipping`);
      continue;
    }

    const password = generatePassword();
    const clientHash = sha256(password);
    const serverHash = await argon2.hash(clientHash);

    const result = insert.run(user.email, serverHash);

    if (result.changes > 0) {
      console.log(`  ✅ ${user.email} (${user.role})`);
      console.log(`     Password: ${password}`);
      console.log('');
      seeded++;
    }
  }

  if (seeded === 0) {
    console.log('  No new users to seed — all users already exist.');
  } else {
    console.log('-'.repeat(60));
    console.log('  ⚠️  SAVE THESE PASSWORDS NOW — they cannot be recovered.');
    console.log('-'.repeat(60));
  }

  console.log('');
  console.log(`  Database: ${dbPath}`);
  console.log('');

  db.close();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
