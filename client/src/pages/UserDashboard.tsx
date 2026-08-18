import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { SopDocument, ReportSummary } from '../types';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import FileDropzone from '../components/FileDropzone';
import LoadingSpinner from '../components/LoadingSpinner';

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatScheduled(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function nowInputValue(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Column({
  title,
  icon,
  count,
  badgeClass,
  children,
}: {
  title: string;
  icon: string;
  count: number;
  badgeClass: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 min-w-[270px] max-w-[320px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-base">{icon}</span>
        <span className="font-semibold text-slate-900 text-sm uppercase tracking-wide">{title}</span>
        <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
          {count}
        </span>
      </div>
      <div
        className="flex-1 overflow-y-auto space-y-3 pr-1"
        style={{ maxHeight: 'calc(100vh - 220px)' }}
      >
        {children}
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center">
      <p className="text-slate-400 text-xs">{text}</p>
    </div>
  );
}

function BoardCard({
  report,
  variant,
  queuePos,
  isPaused,
  onPause,
  onResume,
  onDelete,
}: {
  report: ReportSummary;
  variant: 'todo' | 'reviewing' | 'success' | 'issues';
  queuePos?: number;
  isPaused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
}) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isActive = variant === 'todo' || variant === 'reviewing';

  const borderClass = isPaused
    ? 'border-amber-400'
    : {
        todo: 'border-slate-200',
        reviewing: 'border-blue-400 animate-pulse',
        success: 'border-green-300',
        issues: 'border-red-300',
      }[variant];

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/compare/reports/${report.id}`);
      onDelete?.();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div
      className={`rounded-xl border bg-white p-4 space-y-3 transition-all duration-300 ${borderClass}`}
    >
      {/* ── Delete confirm overlay ── */}
      {confirmDelete ? (
        <div className="space-y-3">
          <p className="text-slate-900 text-sm font-medium">Delete this report?</p>
          <p className="text-slate-600 text-xs break-all">{report.submitted_filename}</p>
          {isActive && (
            <p className="text-amber-600 text-xs">⚠️ This will also cancel the ongoing analysis.</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={handleDelete}
              className="flex-1"
            >
              Delete
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Header: file + time + action buttons ── */}
          <div className="flex items-start gap-2">
            <span className="text-slate-500 mt-0.5 shrink-0">📄</span>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-sm font-medium leading-snug line-clamp-2 break-all">
                {report.submitted_filename}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">{timeAgo(report.created_at)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {isActive && !isPaused && onPause && (
                <button
                  onClick={onPause}
                  title="Pause"
                  className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors text-xs"
                >
                  ⏸
                </button>
              )}
              {isActive && isPaused && onResume && (
                <button
                  onClick={onResume}
                  title="Resume"
                  className="w-6 h-6 flex items-center justify-center rounded-md text-amber-600 hover:text-green-600 hover:bg-green-50 transition-colors text-xs"
                >
                  ▶
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete"
                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-xs"
              >
                🗑
              </button>
            </div>
          </div>

          {/* SOP pill */}
          {report.sop_title && (
            <div>
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-brand-teal/15 border border-brand-teal/25 text-brand-teal max-w-full truncate">
                {report.sop_title}
              </span>
            </div>
          )}

          {/* ── Variant body ── */}
          {variant === 'todo' && !isPaused && (() => {
            const isFutureScheduled = report.scheduled_at && new Date(report.scheduled_at) > new Date();
            return isFutureScheduled ? (
              <div className="flex items-center gap-2 text-violet-600 text-xs">
                <span>⏰</span>
                <span>Scheduled for {formatScheduled(report.scheduled_at!)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-600 text-xs">
                <span>🕐</span>
                <span>In queue{queuePos !== undefined ? ` · #${queuePos}` : ''}</span>
              </div>
            );
          })()}

          {variant === 'reviewing' && !isPaused && (
            <div className="flex items-center gap-2 text-blue-600 text-xs">
              <LoadingSpinner size="sm" color="currentColor" />
              <span>Analysing…</span>
            </div>
          )}

          {isPaused && (
            <div className="flex items-center gap-2 text-amber-600 text-xs">
              <span>⏸</span>
              <span>Paused — click ▶ to resume</span>
            </div>
          )}

          {(variant === 'success' || variant === 'issues') && report.status === 'error' && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 break-words">
              ⚠️ {report.error_message ?? 'Analysis failed'}
            </div>
          )}

          {(variant === 'success' || variant === 'issues') &&
            report.status === 'complete' && (
              <div className="text-xs text-slate-600 leading-relaxed">
                {variant === 'success' ? (
                  <span className="text-green-600 font-medium">Compliance passed</span>
                ) : (
                  <span className="text-red-600 font-medium">Issues found</span>
                )}
                {report.completed_at && <><br />{`Completed ${timeAgo(report.completed_at)}`}</>}
              </div>
            )}

          {(variant === 'success' || variant === 'issues') && report.status === 'complete' && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => navigate(`/report/${report.id}`)}
            >
              View Report →
            </Button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Upload panel (shown inside To Do column) ────────────────────────────────

function UploadPanel({
  sops,
  onClose,
  onSubmitted,
}: {
  sops: SopDocument[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [selectedSop, setSelectedSop] = useState<SopDocument | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [sopSearch, setSopSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  const filtered = sops.filter(
    (s) =>
      s.title.toLowerCase().includes(sopSearch.toLowerCase()) ||
      (s.category ?? '').toLowerCase().includes(sopSearch.toLowerCase())
  );

  async function handleSubmit() {
    if (!selectedSop || !docFile) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const fd = new FormData();
      fd.append('file', docFile);
      fd.append('sopId', String(selectedSop.id));
      if (scheduleEnabled && scheduledAt) {
        fd.append('scheduled_at', new Date(scheduledAt).toISOString());
      }
      await api.upload<{ reportId: number }>('/compare/submit', fd);
      onSubmitted();
    } catch (err) {
      setSubmitError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#BFF143] bg-[#BFF143]/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">New Analysis</p>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-900 text-xs transition-colors"
        >
          ✕ Cancel
        </button>
      </div>

      {/* SOP selector */}
      <div>
        <p className="text-xs text-slate-600 mb-1.5">Select SOP to compare against</p>
        <input
          value={sopSearch}
          onChange={(e) => setSopSearch(e.target.value)}
          placeholder="Search SOPs…"
          className="w-full px-2.5 py-1.5 rounded-lg text-xs text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143] mb-2"
        />
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="text-slate-400 text-xs text-center py-3">No SOPs found</p>
          )}
          {filtered.map((sop) => (
            <button
              key={sop.id}
              type="button"
              onClick={() => setSelectedSop(sop)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all duration-100 ${
                selectedSop?.id === sop.id
                  ? 'border-[#BFF143] bg-[#BFF143]/20 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900'
              }`}
            >
              <span className="font-medium">{sop.title}</span>
              {sop.category && (
                <span className="ml-2 text-brand-teal opacity-80">{sop.category}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* File dropzone */}
      {selectedSop && (
        <div>
          <p className="text-xs text-slate-600 mb-1.5">Upload document (PDF, DOCX, PPTX)</p>
          <FileDropzone
            onFile={setDocFile}
            currentFile={docFile}
            label="Drop file or click to browse"
          />
        </div>
      )}

      {/* Schedule toggle */}
      <div className="border border-slate-200 rounded-lg px-3 py-3 space-y-2 bg-white">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => {
              setScheduleEnabled(e.target.checked);
              if (!e.target.checked) setScheduledAt('');
            }}
            className="w-3.5 h-3.5 accent-[#BFF143]"
          />
          <span className="text-xs text-slate-700 font-medium">⏰ Schedule for later</span>
        </label>
        {scheduleEnabled && (
          <div>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={nowInputValue()}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg text-xs text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-violet-400 [color-scheme:light]"
            />
            {scheduledAt && (
              <p className="text-violet-600 text-[11px] mt-1">
                Will run at {formatScheduled(new Date(scheduledAt).toISOString())}
              </p>
            )}
          </div>
        )}
      </div>

      {submitError && (
        <p className="text-red-600 text-xs">{submitError}</p>
      )}

      <Button
        disabled={!selectedSop || !docFile || submitting || (scheduleEnabled && !scheduledAt)}
        loading={submitting}
        onClick={handleSubmit}
        className="w-full"
      >
        {scheduleEnabled && scheduledAt ? '⏰ Schedule Analysis' : 'Start Analysis'}
      </Button>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function UserDashboard() {
  const { user } = useAuth();

  const [sops, setSops] = useState<SopDocument[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [pausedIds, setPausedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([
      api.get<SopDocument[]>('/sops'),
      api.get<ReportSummary[]>('/compare/reports'),
    ]).then(([s, r]) => {
      setSops(s);
      setReports(r);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const hasActive = reports.some(
      (r) => !pausedIds.has(r.id) && (r.status === 'pending' || r.status === 'processing')
    );
    if (!hasActive) return;
    const t = setInterval(async () => {
      const updated = await api.get<ReportSummary[]>('/compare/reports');
      setReports(updated);
    }, 3000);
    return () => clearInterval(t);
  }, [reports, pausedIds]);

  async function refreshReports() {
    const updated = await api.get<ReportSummary[]>('/compare/reports');
    setReports(updated);
  }

  function pause(id: number) {
    setPausedIds((prev) => new Set([...prev, id]));
  }

  function resume(id: number) {
    setPausedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function removeLocally(id: number) {
    setReports((prev) => prev.filter((r) => r.id !== id));
    setPausedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const toDo       = reports.filter((r) => r.status === 'pending');
  const reviewing  = reports.filter((r) => r.status === 'processing');
  const successful = reports.filter(
    (r) => r.status === 'complete' && (r.compliance_score ?? 0) >= 70
  );
  const withIssues = reports.filter(
    (r) =>
      (r.status === 'complete' && (r.compliance_score ?? 100) < 70) ||
      r.status === 'error'
  );

  const activeCount = reports.filter(
    (r) => !pausedIds.has(r.id) && (r.status === 'pending' || r.status === 'processing')
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FBF8EE' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FBF8EE' }}>
      <Navbar />

      <div className="flex-1 px-6 py-6 flex flex-col gap-5 overflow-hidden">
        {/* ── Page header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              📋 Compliance Board
              {activeCount > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  {activeCount} active
                </span>
              )}
              {pausedIds.size > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  {pausedIds.size} paused
                </span>
              )}
            </h1>
            <p className="text-slate-600 text-sm mt-0.5">Welcome back, {user?.name}</p>
          </div>
          <Button onClick={() => setShowUploadForm(true)}>
            + Upload for Review
          </Button>
        </div>

        {/* ── Stats bar ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
          <span><strong className="text-slate-900">{reports.length}</strong> total analyses</span>
          <span className="text-green-600"><strong>{successful.length}</strong> successful</span>
          <span className="text-red-600"><strong>{withIssues.length}</strong> with issues</span>
          {activeCount > 0 && (
            <span className="text-blue-600"><strong>{activeCount}</strong> in progress</span>
          )}
          {pausedIds.size > 0 && (
            <span className="text-amber-600"><strong>{pausedIds.size}</strong> paused</span>
          )}
        </div>

        {/* ── Board ────────────────────────────────────────────── */}
        <div className="flex gap-4 overflow-x-auto pb-2 items-start flex-1">

          {/* TO DO */}
          <Column
            title="To Do"
            icon="🗂️"
            count={toDo.length}
            badgeClass="bg-slate-200 text-slate-700"
          >
            {showUploadForm ? (
              <UploadPanel
                sops={sops}
                onClose={() => setShowUploadForm(false)}
                onSubmitted={() => {
                  setShowUploadForm(false);
                  refreshReports();
                }}
              />
            ) : (
              <button
                onClick={() => setShowUploadForm(true)}
                className="w-full rounded-xl border border-dashed border-slate-300 bg-white hover:border-[#BFF143] hover:bg-[#BFF143]/10 px-4 py-4 text-slate-500 hover:text-slate-900 text-xs font-medium transition-all duration-150 flex items-center justify-center gap-2"
              >
                <span className="text-base">+</span> Add document
              </button>
            )}

            {toDo.length === 0 && !showUploadForm && (
              <EmptyHint text="Uploaded documents will appear here" />
            )}
            {(() => {
              const now = new Date();
              const queueItems = toDo.filter(
                (r) => !r.scheduled_at || new Date(r.scheduled_at) <= now
              );
              return toDo.map((r) => {
                const isFuture = r.scheduled_at && new Date(r.scheduled_at) > now;
                const pos = isFuture ? undefined : queueItems.indexOf(r) + 1;
                return (
              <BoardCard
                key={r.id}
                report={r}
                variant="todo"
                queuePos={pos}
                isPaused={pausedIds.has(r.id)}
                onPause={() => pause(r.id)}
                onResume={() => resume(r.id)}
                onDelete={() => removeLocally(r.id)}
              />
                );
              });
            })()}
          </Column>

          {/* Divider */}
          <div className="w-px bg-slate-200 self-stretch shrink-0 mt-8" />

          {/* REVIEWING */}
          <Column
            title="Reviewing"
            icon="🔍"
            count={reviewing.length}
            badgeClass="bg-blue-100 text-blue-700"
          >
            {reviewing.length === 0 && (
              <EmptyHint text="Documents being analysed will appear here" />
            )}
            {reviewing.map((r) => (
              <BoardCard
                key={r.id}
                report={r}
                variant="reviewing"
                isPaused={pausedIds.has(r.id)}
                onPause={() => pause(r.id)}
                onResume={() => resume(r.id)}
                onDelete={() => removeLocally(r.id)}
              />
            ))}
          </Column>

          {/* Divider */}
          <div className="w-px bg-slate-200 self-stretch shrink-0 mt-8" />

          {/* SUCCESSFUL */}
          <Column
            title="Successful"
            icon="✅"
            count={successful.length}
            badgeClass="bg-green-100 text-green-700"
          >
            {successful.length === 0 && (
              <EmptyHint text="Compliant documents will appear here" />
            )}
            {successful.map((r) => (
              <BoardCard
                key={r.id}
                report={r}
                variant="success"
                onDelete={() => removeLocally(r.id)}
              />
            ))}
          </Column>

          {/* Divider */}
          <div className="w-px bg-slate-200 self-stretch shrink-0 mt-8" />

          {/* WITH ISSUES */}
          <Column
            title="With Issues"
            icon="⚠️"
            count={withIssues.length}
            badgeClass="bg-red-100 text-red-700"
          >
            {withIssues.length === 0 && (
              <EmptyHint text="Non-compliant documents will appear here" />
            )}
            {withIssues.map((r) => (
              <BoardCard
                key={r.id}
                report={r}
                variant="issues"
                onDelete={() => removeLocally(r.id)}
              />
            ))}
          </Column>
        </div>
      </div>
    </div>
  );
}
