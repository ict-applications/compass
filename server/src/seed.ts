import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
import bcrypt from 'bcryptjs';
import db from './services/db';

const adminHash = bcrypt.hashSync('Admin@1234', 10);
const userHash = bcrypt.hashSync('User@1234', 10);

db.prepare(`
  INSERT OR IGNORE INTO users (email, password_hash, role, name)
  VALUES (?, ?, ?, ?)
`).run('admin@sopcompass.com', adminHash, 'admin', 'Admin');

db.prepare(`
  INSERT OR IGNORE INTO users (email, password_hash, role, name)
  VALUES (?, ?, ?, ?)
`).run('user@sopcompass.com', userHash, 'user', 'Test User');

console.log('Seed complete.');
console.log('  admin@sopcompass.com / Admin@1234 (admin)');
console.log('  user@sopcompass.com  / User@1234  (user)');

process.exit(0);
