import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Card from '../components/Card';

const GRADE_BANDS = [
  {
    range: '80 – 100',
    label: 'Compliant',
    color: '#16A34A',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    description:
      'The submitted document substantially meets all SOP requirements. Minor gaps, if any, do not materially affect operational compliance.',
  },
  {
    range: '50 – 79',
    label: 'Partially Compliant',
    color: '#D97706',
    bg: '#fffbeb',
    border: '#fde68a',
    description:
      'The document covers some SOP requirements but has notable gaps — typically one or more major findings that need to be addressed before the document can be considered fully compliant.',
  },
  {
    range: '0 – 49',
    label: 'Non-Compliant',
    color: '#DC2626',
    bg: '#fef2f2',
    border: '#fecaca',
    description:
      'Significant portions of the SOP are not reflected in the submitted document. Critical or multiple major gaps exist that require substantial revision.',
  },
];

const FACTORS = [
  {
    icon: '✅',
    title: 'Matched Sections',
    weight: 'Positive',
    description:
      'Each SOP section that the submitted document covers fully increases the score. Sections marked "partial" contribute less than fully matched ones.',
  },
  {
    icon: '🔴',
    title: 'Critical Gaps',
    weight: 'Heavy Penalty',
    description:
      'A critical gap means a core SOP requirement is entirely absent or directly contradicted. Even one critical gap will significantly pull the score below 80.',
  },
  {
    icon: '🟠',
    title: 'Major Gaps',
    weight: 'Moderate Penalty',
    description:
      'A major gap means an important requirement is only partially addressed or addressed incorrectly. Multiple major gaps can push a document into non-compliant territory.',
  },
  {
    icon: '🟡',
    title: 'Minor Gaps',
    weight: 'Small Penalty',
    description:
      'A minor gap is a small omission or imprecise wording that does not affect core compliance. Several minor gaps together may lower the score by a few points.',
  },
  {
    icon: '📄',
    title: 'Coverage Breadth',
    weight: 'Positive',
    description:
      'A document that addresses more sections of the SOP — even partially — scores higher than one that only addresses a narrow subset, all else being equal.',
  },
];

export default function ScoreMethodologyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FBF8EE' }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Back link */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">How the Compliance Score is Calculated</h1>
          <p className="mt-2 text-slate-600 leading-relaxed">
            The compliance score (0–100) reflects how thoroughly a submitted document meets the requirements laid out
            in the reference SOP. This page explains the factors that drive the score and why repeating the same
            check should always give you the same result.
          </p>
        </div>

        {/* Score bands */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Score Bands</h2>
          <div className="space-y-3">
            {GRADE_BANDS.map((band) => (
              <div
                key={band.label}
                className="flex items-start gap-4 rounded-lg p-4"
                style={{ background: band.bg, border: `1px solid ${band.border}` }}
              >
                <div className="text-center shrink-0" style={{ minWidth: 72 }}>
                  <span className="text-lg font-bold" style={{ color: band.color }}>{band.range}</span>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: band.color }}>
                    {band.label}
                  </p>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{band.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Factors */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">What Affects the Score</h2>
          <p className="text-sm text-slate-500 mb-4">
            The AI analyses the submitted document against the SOP and weighs the following factors holistically.
            There is no fixed arithmetic formula — the model reasons about each document pair the same way a
            trained compliance auditor would.
          </p>
          <div className="space-y-4">
            {FACTORS.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-900">{f.title}</span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{
                        background: f.weight === 'Positive' ? '#f0fdf4' : f.weight === 'Heavy Penalty' ? '#fef2f2' : f.weight === 'Moderate Penalty' ? '#fff7ed' : '#fefce8',
                        color: f.weight === 'Positive' ? '#16A34A' : f.weight === 'Heavy Penalty' ? '#DC2626' : f.weight === 'Moderate Penalty' ? '#D97706' : '#CA8A04',
                      }}
                    >
                      {f.weight}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Consistency */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-2">Why the Same Document Always Gets the Same Score</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">
            AI language models are probabilistic by default — small random variations in output can produce slightly
            different scores on repeated runs. To eliminate this, Compass Project runs all analyses at{' '}
            <strong>temperature 0</strong>, which instructs the model to always choose the highest-probability
            response rather than sampling randomly.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">
            This means: given the same SOP and the same submitted document, the model will produce an identical
            analysis every time — same score, same gaps, same recommendations.
          </p>
          <div className="rounded-lg p-4 bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">When you might still see a different score</p>
            <ul className="text-sm text-slate-700 space-y-1.5 list-disc list-inside">
              <li>The SOP document was updated between runs</li>
              <li>The submitted document was re-uploaded with changes</li>
              <li>The AI model configured in LLM Settings was changed</li>
              <li>The AI provider updated the underlying model weights (rare, and they version their models)</li>
            </ul>
          </div>
        </Card>

        {/* Footer note */}
        <p className="text-xs text-slate-400 text-center pb-4">
          Compass Project · Banyan Group · Compliance Analysis Engine
        </p>
      </div>
    </div>
  );
}
