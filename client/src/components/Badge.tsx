type BadgeVariant =
  | 'critical'
  | 'major'
  | 'minor'
  | 'compliant'
  | 'partial'
  | 'noncompliant'
  | 'high'
  | 'medium'
  | 'low'
  | 'full'
  | 'admin'
  | 'user'
  | 'pending'
  | 'processing'
  | 'complete'
  | 'error';

const STYLES: Record<BadgeVariant, string> = {
  critical:     'bg-red-100 text-red-700 border border-red-200',
  major:        'bg-amber-100 text-amber-700 border border-amber-200',
  minor:        'bg-blue-100 text-blue-700 border border-blue-200',
  compliant:    'bg-green-100 text-green-700 border border-green-200',
  partial:      'bg-amber-100 text-amber-700 border border-amber-200',
  noncompliant: 'bg-red-100 text-red-700 border border-red-200',
  high:         'bg-red-100 text-red-700 border border-red-200',
  medium:       'bg-amber-100 text-amber-700 border border-amber-200',
  low:          'bg-blue-100 text-blue-700 border border-blue-200',
  full:         'bg-green-100 text-green-700 border border-green-200',
  admin:        'bg-purple-100 text-purple-700 border border-purple-200',
  user:         'bg-slate-100 text-slate-600 border border-slate-200',
  pending:      'bg-slate-100 text-slate-600 border border-slate-200',
  processing:   'bg-blue-100 text-blue-700 border border-blue-200',
  complete:     'bg-green-100 text-green-700 border border-green-200',
  error:        'bg-red-100 text-red-700 border border-red-200',
};

interface Props {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}

export default function Badge({ variant, label, className = '' }: Props) {
  const text = label ?? variant.charAt(0).toUpperCase() + variant.slice(1);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${STYLES[variant]} ${className}`}>
      {text}
    </span>
  );
}
