import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../services/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { parseDocument } from '../services/documentParser';

const router = Router();

const SUBMISSIONS_DIR = path.join(process.cwd(), 'data', 'submissions');
fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SUBMISSIONS_DIR),
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

router.post(
  '/submit',
  authenticateToken,
  multerSingle('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { sopId, scheduled_at } = req.body as { sopId?: string; scheduled_at?: string };
    if (!sopId) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'sopId is required' });
      return;
    }

    const sop = db
      .prepare('SELECT id, title, extracted_text FROM sop_documents WHERE id = ? AND is_active = 1')
      .get(Number(sopId)) as
      | { id: number; title: string; extracted_text: string }
      | undefined;

    if (!sop) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'SOP not found' });
      return;
    }

    let submittedText = '';
    try {
      const parsed = await parseDocument(req.file.path, req.file.mimetype);
      submittedText = parsed.text;
    } catch (err) {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ error: `Failed to parse document: ${(err as Error).message}` });
      return;
    }

    // Validate scheduled_at if provided — must be a future datetime
    let scheduledAt: string | null = null;
    if (scheduled_at) {
      const scheduledDate = new Date(scheduled_at);
      if (isNaN(scheduledDate.getTime())) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'Invalid scheduled_at date' });
        return;
      }
      scheduledAt = scheduledDate.toISOString();
    }

    const result = db
      .prepare(
        `INSERT INTO comparison_reports
         (user_id, submitted_filename, submitted_filepath, submitted_text, sop_id, status, scheduled_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`
      )
      .run(req.user!.userId, req.file.originalname, req.file.path, submittedText, sop.id, scheduledAt);

    const reportId = Number(result.lastInsertRowid);

    res.status(202).json({ reportId });
    // Queue worker picks this up automatically — no setImmediate needed
  }
);

router.get('/status/:reportId', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { reportId } = req.params;

  const report = db
    .prepare('SELECT id, status, compliance_score, error_message, user_id FROM comparison_reports WHERE id = ?')
    .get(Number(reportId)) as
    | { id: number; status: string; compliance_score: number | null; error_message: string | null; user_id: number }
    | undefined;

  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  if (req.user!.role !== 'admin' && report.user_id !== req.user!.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json({ id: report.id, status: report.status, compliance_score: report.compliance_score, error_message: report.error_message });
});

router.get('/reports', authenticateToken, (req: AuthRequest, res: Response): void => {
  let reports;
  if (req.user!.role === 'admin') {
    reports = db
      .prepare(
        `SELECT cr.id, cr.submitted_filename, cr.status, cr.compliance_score, cr.error_message,
                cr.scheduled_at, cr.created_at, cr.completed_at,
                sd.title as sop_title, sd.brand as sop_brand, sd.property as sop_property,
                u.name as user_name, u.email as user_email
         FROM comparison_reports cr
         LEFT JOIN sop_documents sd ON cr.sop_id = sd.id
         LEFT JOIN users u ON cr.user_id = u.id
         ORDER BY cr.created_at DESC`
      )
      .all();
  } else {
    reports = db
      .prepare(
        `SELECT cr.id, cr.submitted_filename, cr.status, cr.compliance_score, cr.error_message,
                cr.scheduled_at, cr.created_at, cr.completed_at,
                sd.title as sop_title
         FROM comparison_reports cr
         LEFT JOIN sop_documents sd ON cr.sop_id = sd.id
         WHERE cr.user_id = ?
         ORDER BY cr.created_at DESC`
      )
      .all(req.user!.userId);
  }
  res.json(reports);
});

router.get('/reports/:id', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;

  const report = db
    .prepare(
      `SELECT cr.*, sd.title as sop_title, sd.category as sop_category, sd.version as sop_version
       FROM comparison_reports cr
       LEFT JOIN sop_documents sd ON cr.sop_id = sd.id
       WHERE cr.id = ?`
    )
    .get(Number(id)) as Record<string, unknown> | undefined;

  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  if (req.user!.role !== 'admin' && report.user_id !== req.user!.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json({
    ...report,
    gaps: safeJsonParse(report.gap_analysis as string, []),
    recommendations: safeJsonParse(report.recommendations as string, []),
    matched_sections: safeJsonParse(report.matched_sections as string, []),
    gap_analysis: undefined,
  });
});

router.delete('/reports/:id', authenticateToken, (req: AuthRequest, res: Response): void => {
  const { id } = req.params;

  const report = db
    .prepare('SELECT id, user_id, submitted_filepath FROM comparison_reports WHERE id = ?')
    .get(Number(id)) as { id: number; user_id: number; submitted_filepath: string } | undefined;

  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  if (req.user!.role !== 'admin' && report.user_id !== req.user!.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Best-effort: delete the uploaded file
  try { fs.unlinkSync(report.submitted_filepath); } catch { /* already gone */ }

  db.prepare('DELETE FROM comparison_reports WHERE id = ?').run(Number(id));
  res.json({ success: true });
});

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default router;
