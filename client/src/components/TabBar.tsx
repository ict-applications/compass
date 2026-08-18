interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export default function TabBar({ tabs, active, onChange }: Props) {
  return (
    <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-150 border-b-2 -mb-px
            ${active === tab.id
              ? 'border-[#BFF143] text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }
          `}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
              active === tab.id ? 'bg-[#BFF143]/30 text-slate-900' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
