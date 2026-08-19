import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
import bcrypt from 'bcryptjs';
import db from './services/db';

const adminHash = bcrypt.hashSync('Admin@1234', 10);
const userHash = bcrypt.hashSync('User@1234', 10);

// Upsert rather than INSERT OR IGNORE: this runs on every boot, and an
// existing row with a stale hash would otherwise be skipped silently,
// locking the demo account out with no way to recover (no shell on Render).
const upsert = db.prepare(`
  INSERT INTO users (email, password_hash, role, name)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET
    password_hash = excluded.password_hash,
    role = excluded.role
`);

upsert.run('admin@sopcompass.com', adminHash, 'admin', 'Admin');
upsert.run('user@sopcompass.com', userHash, 'user', 'Test User');

const accounts = db
  .prepare('SELECT id, email, role FROM users ORDER BY id')
  .all() as Array<{ id: number; email: string; role: string }>;

console.log('Seed complete. Accounts now in database:');
for (const a of accounts) console.log(`  #${a.id} ${a.email} (${a.role})`);

process.exit(0);
