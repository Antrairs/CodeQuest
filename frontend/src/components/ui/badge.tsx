import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'muted'
}

const toneClass = {
  default: 'bg-slate-950 text-white',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  muted: 'bg-slate-100 text-slate-700',
}

export function Badge({ className, tone = 'muted', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold',
        toneClass[tone],
        className,
      )}
      {...props}
    />
  )
}

