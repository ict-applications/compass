import db from './db';
import { compareDocuments } from './aiComparator';

let isProcessing = false;
let workerStarted = false;

interface PendingJob {
  id: number;
  submitted_text: string;
  sop_title: string;
  sop_text: string;
}

async function processNext(): Promise<void> {
  if (isProcessing) return;

  // Safety net: if server restarted mid-job, a report may be stuck in 'processing'
  // Re-check DB state before claiming the slot
  const inProgress = db
    .prepare("SELECT id FROM comparison_reports WHERE status = 'processing'")
    .get();
  if (inProgress) return;

  // Find the oldest ready job:
  // unscheduled items use created_at as their "ready time" so they are ordered alongside scheduled ones
  const job = db
    .prepare(
      `SELECT cr.id, cr.submitted_text,
              sd.title AS sop_title, sd.extracted_text AS sop_text
       FROM comparison_reports cr
       JOIN sop_documents sd ON cr.sop_id = sd.id
       WHERE cr.status = 'pending'
         AND (cr.scheduled_at IS NULL OR cr.scheduled_at <= datetime('now'))
       ORDER BY COALESCE(cr.scheduled_at, cr.created_at) ASC
       LIMIT 1`
    )
    .get() as PendingJob | undefined;

  if (!job) return;

  isProcessing = true;
  db.prepare("UPDATE comparison_reports SET status = 'processing' WHERE id = ?").run(job.id);

  try {
    const report = await compareDocuments(
      job.sop_text || '',
      job.submitted_text || '',
      job.sop_title
    );
    db.prepare(
      `UPDATE comparison_reports
       SET status = 'complete',
           compliance_score = ?,
           summary = ?,
           gap_analysis = ?,
           recommendations = ?,
           matched_sections = ?,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      report.compliance_score,
      report.executive_summary,
      JSON.stringify(report.gaps),
      JSON.stringify(report.recommendations),
      JSON.stringify(report.matched_sections),
      job.id
    );
  } catch (err) {
    db.prepare(
      "UPDATE comparison_reports SET status = 'error', error_message = ? WHERE id = ?"
    ).run(String(err), job.id);
  } finally {
    isProcessing = false;
  }
}

export function startQueueWorker(): void {
  if (workerStarted) return;
  workerStarted = true;

  // Reset any reports stuck in 'processing' from a previous crashed run
  db.prepare("UPDATE comparison_reports SET status = 'pending' WHERE status = 'processing'").run();

  // Check immediately, then every 5 seconds
  processNext();
  setInterval(processNext, 5000);

  console.log('Queue worker started — processing one report at a time');
}
