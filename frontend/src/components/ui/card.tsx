import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'div' | 'section'
}

export function Card({ as: Component = 'div', className, ...props }: CardProps) {
  return (
    <Component
      className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-slate-200 px-4 py-3', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}
