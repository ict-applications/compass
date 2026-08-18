import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../services/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.toLowerCase().trim()) as
    | { id: number; email: string; password_hash: string; role: string; name: string }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.post('/logout', (_req: Request, res: Response): void => {
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authenticateToken, (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = db
    .prepare('SELECT id, email, name, role FROM users WHERE id = ?')
    .get(req.user.userId) as
    | { id: number; email: string; name: string; role: string }
    | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

export default router;
