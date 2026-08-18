import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ComparisonReport, Gap, Recommendation, MatchedSection } from '../types';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';
import TabBar from '../components/TabBar';
import Button from '../components/Button';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [report, setReport] = useState<ComparisonReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('gaps');
  const [expandedRec, setExpandedRec] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchReport() {
      try {
        const data = await api.get<ComparisonReport>(`/compare/reports/${id}`);
        setReport(data);
        if (data.status === 'complete' || data.status === 'error') {
          if (interval) clearInterval(interval);
          setLoading(false);
        }
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
        if (interval) clearInterval(interval);
      }
    }

    fetchReport().then(() => {
      setLoading(false);
    });

    interval = setInterval(async () => {
      const current = await api.get<ComparisonReport>(`/compare/reports/${id}`).catch(() => null);
      if (!current) return;
      setReport(current);
      if (current.status === 'complete' || current.status === 'error') {
        if (interval) clearInterval(interval);
      }
    }, 3000);

    return () => { if (interval) clearInterval(interval); };
  }, [id]);

  function toggleRec(i: number) {
    setExpandedRec((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (loading && !report) {
    return (
      <div className="min-h-screen" style={{ background: '#FBF8EE' }}>
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-slate-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen" style={{ background: '#FBF8EE' }}>
        <Navbar />
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to load report</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <Button onClick={() => navigate('/dashboard')}>← Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  if (report.status === 'pending' || report.status === 'processing') {
    return (
      <div className="min-h-screen" style={{ background: '#FBF8EE' }}>
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <LoadingSpinner size="lg" />
          <h2 className="text-lg font-semibold text-slate-900">Analysis in progress...</h2>
          <Badge variant={report.status} label={report.status === 'processing' ? 'Processing' : 'Queued'} />
          <p className="text-slate-600 text-sm">This page will update automatically.</p>
        </div>
      </div>
    );
  }

  if (report.status === 'error') {
    return (
      <div className="min-h-screen" style={{ background: '#FBF8EE' }}>
        <Navbar />
        <div className="max-w-xl mx-auto px-6 py-20 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Analysis Failed</h2>
          <p className="text-slate-600 mb-2">Something went wrong during AI analysis.</p>
          {report.error_message && (
            <pre className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-left whitespace-pre-wrap">
              {report.error_message}
            </pre>
          )}
          <Button onClick={() => navigate('/dashboard')}>← Try Again</Button>
        </div>
      </div>
    );
  }

  const gaps = report.gaps ?? [];
  const recs = report.recommendations ?? [];
  const matched = report.matched_sections ?? [];

  const criticalCount = gaps.filter((g) => g.severity === 'critical').length;
  const majorCount = gaps.filter((g) => g.severity === 'major').length;
  const minorCount = gaps.filter((g) => g.severity === 'minor').length;

  const assessmentLabel = report.overall_assessment === 'compliant'
    ? 'COMPLIANT'
    : report.overall_assessment === 'partially_compliant'
    ? 'PARTIALLY COMPLIANT'
    : 'NON-COMPLIANT';

  const assessmentColor = report.overall_assessment === 'compliant'
    ? '#16A34A'
    : report.overall_assessment === 'partially_compliant'
    ? '#D97706'
    : '#DC2626';

  const gapTabLabel = `Gaps & Issues${gaps.length ? ` (${criticalCount}C ${majorCount}M ${minorCount}m)` : ''}`;

  const tabs = [
    { id: 'gaps', label: gapTabLabel, count: gaps.length },
    { id: 'recs', label: 'Recommendations', count: recs.length },
    { id: 'matched', label: 'Compliant Sections', count: matched.length },
    ...(isAdmin ? [{ id: 'raw', label: 'Raw Details' }] : []),
  ];

  return (
    <div className="min-h-screen" style={{ background: '#FBF8EE' }}>
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Top bar */}
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
              <button onClick={() => navigate('/dashboard')} className="hover:text-slate-900 transition-colors">
                ← Dashboard
              </button>
            </div>
            <h1 className="text-xl font-bold text-slate-900 leading-snug">
              {report.submitted_filename}
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              vs. <span className="text-brand-teal font-medium">{report.sop_title}</span>
              {report.sop_category && ` · ${report.sop_category}`}
              {report.sop_version && ` · v${report.sop_version}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase text-center"
              style={{ color: assessmentColor, background: `${assessmentColor}18`, border: `1px solid ${assessmentColor}40` }}
            >
              {assessmentLabel}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="no-print"
              onClick={() => window.print()}
            >
              🖨 Export / Print
            </Button>
          </div>
        </div>

        {/* Executive Summary */}
        {report.summary && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Executive Summary</h2>
            <p className="text-slate-800 leading-relaxed">{report.summary}</p>
          </Card>
        )}

        {/* Tabs */}
        <div>
          <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

          <div className="mt-4 tab-content space-y-3">
            {activeTab === 'gaps' && (
              <>
                {gaps.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-green-600">✓ No gaps identified — document appears fully compliant.</p>
                  </Card>
                ) : (
                  <>
                    {(['critical', 'major', 'minor'] as const).map((sev) => {
                      const sevGaps = gaps.filter((g) => g.severity === sev);
                      if (!sevGaps.length) return null;
                      return (
                        <div key={sev} className="print-break">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                            {sev} ({sevGaps.length})
                          </h3>
                          <div className="space-y-2">
                            {sevGaps.map((gap, i) => (
                              <GapCard key={i} gap={gap} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {activeTab === 'recs' && (
              <>
                {recs.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-slate-500">No recommendations at this time.</p>
                  </Card>
                ) : (
                  (['high', 'medium', 'low'] as const).map((pri) => {
                    const priRecs = recs.filter((r) => r.priority === pri);
                    if (!priRecs.length) return null;
                    return (
                      <div key={pri}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                          {pri} priority ({priRecs.length})
                        </h3>
                        <div className="space-y-2">
                          {priRecs.map((rec, i) => {
                            const globalIdx = recs.indexOf(rec);
                            return (
                              <RecCard
                                key={i}
                                rec={rec}
                                expanded={expandedRec.has(globalIdx)}
                                onToggle={() => toggleRec(globalIdx)}
                                onCopy={() => copyText(rec.suggested_language ?? rec.action)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'matched' && (
              <>
                {matched.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-slate-500">No matched sections found.</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {matched.map((m, i) => (
                      <MatchedCard key={i} section={m} />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'raw' && isAdmin && (
              <Card className="p-5">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap overflow-x-auto max-h-[600px]">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GapCard({ gap }: { gap: Gap }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Badge variant={gap.severity} />
        <div className="flex-1 min-w-0">
          {gap.document_section && (
            <div className="inline-flex items-center gap-1.5 mb-2 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="shrink-0 text-amber-600">
                <path d="M2 2h8l4 4v8H2V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M10 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M5 9h6M5 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">In your document:</span>
              <span className="text-xs text-amber-800 font-medium">{gap.document_section}</span>
            </div>
          )}
          <p className="text-slate-900 font-medium text-sm">{gap.gap_description}</p>
          <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 uppercase tracking-wide text-[10px]">SOP Requires</span>
              <p className="text-slate-700 mt-0.5">{gap.sop_requirement}</p>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wide text-[10px]">Current Status</span>
              <p className="text-slate-700 mt-0.5">{gap.current_status}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RecCard({ rec, expanded, onToggle, onCopy }: {
  rec: Recommendation;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Badge variant={rec.priority} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wide">{rec.section}</p>
          <p className="text-slate-900 text-sm mt-1">{rec.action}</p>
          {rec.suggested_language && (
            <div className="mt-2">
              <button
                onClick={onToggle}
                className="text-xs text-[#121113] font-semibold underline-offset-2 hover:underline"
              >
                {expanded ? '▲ Hide' : '▼ Show'} Suggested Language
              </button>
              {expanded && (
                <div className="mt-2 relative">
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 whitespace-pre-wrap">
                    {rec.suggested_language}
                  </pre>
                  <button
                    onClick={onCopy}
                    className="absolute top-2 right-2 text-xs text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function MatchedCard({ section }: { section: MatchedSection }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant={section.compliance_level === 'full' ? 'compliant' : 'partial'} label={section.compliance_level === 'full' ? 'Full' : 'Partial'} />
        {section.notes && <span className="text-xs text-slate-500">{section.notes}</span>}
      </div>
      <div className="grid sm:grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-slate-500 uppercase tracking-wide text-[10px] mb-1">SOP Section</p>
          <p className="text-slate-800">{section.sop_section}</p>
        </div>
        <div>
          <p className="text-slate-500 uppercase tracking-wide text-[10px] mb-1">Document Excerpt</p>
          <p className="text-slate-800">{section.document_excerpt}</p>
        </div>
      </div>
    </Card>
  );
}
