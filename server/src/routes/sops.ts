import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { parseDocument } from '../services/documentParser';

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const validExt = ['.pdf', '.docx', '.doc', '.pptx'].includes(ext);
    const validMime = ALLOWED_MIMES.includes(file.mimetype);
    if (validExt && validMime) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and PPTX files are allowed'));
    }
  },
});

function multerSingle(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upload.single(fieldName)(req as any, res, (err) => {
      if (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
      next();
    });
  };
}

router.get('/', authenticateToken, (req: AuthRequest, res: Response): void => {
  const sops = db
    .prepare(
      `SELECT id, title, description, category, brand, property, version, filename, is_active, created_at, updated_at
       FROM sop_documents WHERE is_active = 1 ORDER BY created_at DESC`
    )
    .all();
  res.json(sops);
});

router.post(
  '/upload',
  authenticateToken,
  requireAdmin,
  multerSingle('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { title, description, category, brand, property, version } = req.body as {
      title?: string;
      description?: string;
      category?: string;
      brand?: string;
      property?: string;
      version?: string;
    };

    if (!title) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    try {
      const parsed = await parseDocument(req.file.path, req.file.mimetype);

      const result = db
        .prepare(
          `INSERT INTO sop_documents (title, description, category, brand, property, version, filename, filepath, extracted_text, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          title,
          description || null,
          category || null,
          brand || null,
          property || null,
          version || '1.0',
          req.file.originalname,
          req.file.path,
          parsed.text,
          req.user!.userId
        );

      const sop = db
        .prepare('SELECT * FROM sop_documents WHERE id = ?')
        .get(result.lastInsertRowid);

      res.status(201).json(sop);
    } catch (err) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: `Failed to process document: ${(err as Error).message}` });
    }
  }
);

router.put('/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;
  const { title, description, category, brand, property, version, is_active } = req.body as {
    title?: string;
    description?: string;
    category?: string;
    brand?: string;
    property?: string;
    version?: string;
    is_active?: number;
  };

  const sop = db
    .prepare('SELECT * FROM sop_documents WHERE id = ?')
    .get(Number(id)) as { id: number } | undefined;

  if (!sop) {
    res.status(404).json({ error: 'SOP not found' });
    return;
  }

  db.prepare(
    `UPDATE sop_documents
     SET title = COALESCE(?, title),
         description = COALESCE(?, description),
         category = COALESCE(?, category),
         brand = COALESCE(?, brand),
         property = COALESCE(?, property),
         version = COALESCE(?, version),
         is_active = COALESCE(?, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    title ?? null,
    description ?? null,
    category ?? null,
    brand ?? null,
    property ?? null,
    version ?? null,
    is_active ?? null,
    Number(id)
  );

  const updated = db.prepare('SELECT * FROM sop_documents WHERE id = ?').get(Number(id));
  res.json(updated);
});

router.delete('/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;

  const sop = db
    .prepare('SELECT * FROM sop_documents WHERE id = ?')
    .get(Number(id)) as { id: number } | undefined;

  if (!sop) {
    res.status(404).json({ error: 'SOP not found' });
    return;
  }

  db.prepare(
    `UPDATE sop_documents SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(Number(id));

  res.json({ message: 'SOP deactivated successfully' });
});

router.get('/:id/preview', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;

  const sop = db
    .prepare('SELECT title, description, category, version, filename, extracted_text, created_at FROM sop_documents WHERE id = ?')
    .get(Number(id)) as
    | { title: string; description: string; category: string; version: string; filename: string; extracted_text: string; created_at: string }
    | undefined;

  if (!sop) {
    res.status(404).json({ error: 'SOP not found' });
    return;
  }

  res.json({
    ...sop,
    preview: (sop.extracted_text || '').slice(0, 2000),
    extracted_text: undefined,
  });
});

export default router;
