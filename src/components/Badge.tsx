import type { ReactNode } from 'react';

const toneClasses = {
  idle: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  processing: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  queued: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  'pending-held': 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  'processing-stopped': 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  completed: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  canceled: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  aborted: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  error: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  stopped: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  admin: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  user: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  default: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
} as const;

export default function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: string }) {
  const toneClass = tone in toneClasses ? toneClasses[tone as keyof typeof toneClasses] : toneClasses.default;

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}
