interface Props {
  score: number;
  size?: number;
}

export default function ScoreGauge({ score, size = 140 }: Props) {
  const radius = (size - 20) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626';

  const label =
    score >= 80 ? 'Compliant' : score >= 50 ? 'Partial' : 'Non-Compliant';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Track */}
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
        {/* Label only */}
        <text
          x={size / 2}
          y={size / 2 + 6}
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.11}
          fontWeight="700"
          fontFamily="DM Sans, sans-serif"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
