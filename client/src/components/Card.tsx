import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export default function Card({ children, className = '', onClick, selected = false }: Props) {
  const base = 'rounded-xl border bg-white transition-all duration-150';
  const border = selected
    ? 'border-[#BFF143] shadow-md shadow-[#BFF143]/20'
    : 'border-slate-200 hover:border-slate-300';
  const cursor = onClick ? 'cursor-pointer' : '';

  return (
    <div className={`${base} ${border} ${cursor} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}
