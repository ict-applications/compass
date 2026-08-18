import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../services/db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken, requireAdmin);

interface UserRow {
  id: number;
  login: string | null;
  name: string;
  email: string;
  role: string;
  created_at: string;
  properties_str: string | null;
}

function formatUser(row: UserRow) {
  return {
    id: row.id,
    login: row.login ?? '',
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
    properties: row.properties_str ? row.properties_str.split('|') : [],
  };
}

// GET /api/admin/users
router.get('/users', (_req: AuthRequest, res: Response): void => {
  const rows = db.prepare(`
    SELECT u.id, u.login, u.name, u.email, u.role, u.created_at,
           GROUP_CONCAT(up.property, '|') AS properties_str
    FROM users u
    LEFT JOIN user_properties up ON u.id = up.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all() as UserRow[];
  res.json(rows.map(formatUser));
});

// POST /api/admin/users
router.post('/users', (req: AuthRequest, res: Response): void => {
  const { login, password, name, email, role, properties } = req.body as {
    login?: string;
    password?: string;
    name?: string;
    email?: string;
    role?: string;
    properties?: string[];
  };

  if (!password || !name || !email) {
    res.status(400).json({ error: 'Password, name and email are required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    res.status(409).json({ error: 'A user with this email already exists' });
    return;
  }

  if (login) {
    const existingLogin = db.prepare('SELECT id FROM users WHERE login = ?').get(login.trim());
    if (existingLogin) {
      res.status(409).json({ error: 'A user with this login already exists' });
      return;
    }
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    `INSERT INTO users (login, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`
  ).run(
    login?.trim() || null,
    name.trim(),
    email.toLowerCase().trim(),
    hash,
    role === 'admin' ? 'admin' : 'user'
  );

  const userId = Number(result.lastInsertRowid);
  setUserProperties(userId, properties ?? []);

  const row = db.prepare(`
    SELECT u.id, u.login, u.name, u.email, u.role, u.created_at,
           GROUP_CONCAT(up.property, '|') AS properties_str
    FROM users u
    LEFT JOIN user_properties up ON u.id = up.user_id
    WHERE u.id = ?
    GROUP BY u.id
  `).get(userId) as UserRow;

  res.status(201).json(formatUser(row));
});

// PUT /api/admin/users/:id
router.put('/users/:id', (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);
  const { login, password, name, email, role, properties } = req.body as {
    login?: string;
    password?: string;
    name?: string;
    email?: string;
    role?: string;
    properties?: string[];
  };

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  if (email) {
    const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase().trim(), id);
    if (conflict) { res.status(409).json({ error: 'Email already used by another user' }); return; }
  }

  if (login) {
    const conflict = db.prepare('SELECT id FROM users WHERE login = ? AND id != ?').get(login.trim(), id);
    if (conflict) { res.status(409).json({ error: 'Login already used by another user' }); return; }
  }

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  }

  db.prepare(`
    UPDATE users SET
      login = COALESCE(?, login),
      name  = COALESCE(?, name),
      email = COALESCE(?, email),
      role  = COALESCE(?, role)
    WHERE id = ?
  `).run(
    login !== undefined ? (login.trim() || null) : null,
    name ?? null,
    email ? email.toLowerCase().trim() : null,
    role ? (role === 'admin' ? 'admin' : 'user') : null,
    id
  );

  if (properties !== undefined) setUserProperties(id, properties);

  const row = db.prepare(`
    SELECT u.id, u.login, u.name, u.email, u.role, u.created_at,
           GROUP_CONCAT(up.property, '|') AS properties_str
    FROM users u
    LEFT JOIN user_properties up ON u.id = up.user_id
    WHERE u.id = ?
    GROUP BY u.id
  `).get(id) as UserRow;

  res.json(formatUser(row));
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);

  if (id === req.user!.userId) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  db.prepare('DELETE FROM user_properties WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

function setUserProperties(userId: number, properties: string[]) {
  db.prepare('DELETE FROM user_properties WHERE user_id = ?').run(userId);
  const insert = db.prepare('INSERT OR IGNORE INTO user_properties (user_id, property) VALUES (?, ?)');
  for (const p of properties) {
    const trimmed = p.trim();
    if (trimmed) insert.run(userId, trimmed);
  }
}

// ─── Brands ──────────────────────────────────────────────────────────────────

router.get('/brands', (_req: AuthRequest, res: Response): void => {
  const brands = db.prepare(
    `SELECT b.id, b.name, b.created_at, b.updated_at,
            COUNT(p.id) as property_count
     FROM brands b
     LEFT JOIN properties p ON p.brand_id = b.id
     GROUP BY b.id ORDER BY b.name ASC`
  ).all();
  res.json(brands);
});

router.post('/brands', (req: AuthRequest, res: Response): void => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const exists = db.prepare('SELECT id FROM brands WHERE name = ?').get(name.trim());
  if (exists) { res.status(409).json({ error: 'Brand already exists' }); return; }
  const result = db.prepare('INSERT INTO brands (name) VALUES (?)').run(name.trim());
  res.status(201).json(db.prepare('SELECT * FROM brands WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/brands/:id', (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const brand = db.prepare('SELECT id FROM brands WHERE id = ?').get(id);
  if (!brand) { res.status(404).json({ error: 'Brand not found' }); return; }
  const conflict = db.prepare('SELECT id FROM brands WHERE name = ? AND id != ?').get(name.trim(), id);
  if (conflict) { res.status(409).json({ error: 'Brand name already taken' }); return; }
  db.prepare('UPDATE brands SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name.trim(), id);
  res.json(db.prepare('SELECT * FROM brands WHERE id = ?').get(id));
});

router.delete('/brands/:id', (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);
  const brand = db.prepare('SELECT id FROM brands WHERE id = ?').get(id);
  if (!brand) { res.status(404).json({ error: 'Brand not found' }); return; }
  db.prepare('DELETE FROM brands WHERE id = ?').run(id);
  res.json({ success: true });
});

// ─── Properties ──────────────────────────────────────────────────────────────

router.get('/properties', (_req: AuthRequest, res: Response): void => {
  const props = db.prepare(
    `SELECT p.id, p.name, p.brand_id, p.created_at, p.updated_at, b.name as brand_name
     FROM properties p
     LEFT JOIN brands b ON b.id = p.brand_id
     ORDER BY b.name ASC, p.name ASC`
  ).all();
  res.json(props);
});

router.post('/properties', (req: AuthRequest, res: Response): void => {
  const { name, brand_id } = req.body as { name?: string; brand_id?: number | null };
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const brandId = brand_id ?? null;
  const exists = db.prepare('SELECT id FROM properties WHERE name = ? AND brand_id IS ?').get(name.trim(), brandId);
  if (exists) { res.status(409).json({ error: 'Property already exists under this brand' }); return; }
  const result = db.prepare('INSERT INTO properties (name, brand_id) VALUES (?, ?)').run(name.trim(), brandId);
  const row = db.prepare(
    `SELECT p.*, b.name as brand_name FROM properties p LEFT JOIN brands b ON b.id = p.brand_id WHERE p.id = ?`
  ).get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/properties/:id', (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);
  const { name, brand_id } = req.body as { name?: string; brand_id?: number | null };
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const prop = db.prepare('SELECT id FROM properties WHERE id = ?').get(id);
  if (!prop) { res.status(404).json({ error: 'Property not found' }); return; }
  const brandId = brand_id ?? null;
  const conflict = db.prepare('SELECT id FROM properties WHERE name = ? AND brand_id IS ? AND id != ?').get(name.trim(), brandId, id);
  if (conflict) { res.status(409).json({ error: 'Property name already exists under this brand' }); return; }
  db.prepare('UPDATE properties SET name = ?, brand_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name.trim(), brandId, id);
  const row = db.prepare(
    `SELECT p.*, b.name as brand_name FROM properties p LEFT JOIN brands b ON b.id = p.brand_id WHERE p.id = ?`
  ).get(id);
  res.json(row);
});

router.delete('/properties/:id', (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);
  const prop = db.prepare('SELECT id FROM properties WHERE id = ?').get(id);
  if (!prop) { res.status(404).json({ error: 'Property not found' }); return; }
  db.prepare('DELETE FROM properties WHERE id = ?').run(id);
  res.json({ success: true });
});

// ─── Categories ──────────────────────────────────────────────────────────────

router.get('/categories', (_req: AuthRequest, res: Response): void => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(cats);
});

router.post('/categories', (req: AuthRequest, res: Response): void => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const exists = db.prepare('SELECT id FROM categories WHERE name = ?').get(name.trim());
  if (exists) { res.status(409).json({ error: 'Category already exists' }); return; }
  const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/categories/:id', (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!cat) { res.status(404).json({ error: 'Category not found' }); return; }
  const conflict = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(name.trim(), id);
  if (conflict) { res.status(409).json({ error: 'Category name already taken' }); return; }
  db.prepare('UPDATE categories SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name.trim(), id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
});

router.delete('/categories/:id', (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);
  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!cat) { res.status(404).json({ error: 'Category not found' }); return; }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
