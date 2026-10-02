import type { ReactNode } from 'react'

// BAS-8 (hito 0.2, roadmap-front.md § 3) — chip de dato corto (+40 XP, −5 Serhu, etiquetas). Antes
// cada sitio escribía su tira de clases.

export type TonoChip = 'accent' | 'accent2' | 'moss' | 'danger' | 'quest' | 'neutral'

const TONO: Record<TonoChip, string> = {
  accent: 'border-accent-600/50 bg-accent-500/10 text-accent-300',
  accent2: 'border-accent2-600/50 bg-accent2-500/10 text-accent2-300',
  moss: 'border-moss-600/50 bg-moss-500/10 text-moss-300',
  danger: 'border-danger-600/50 bg-danger-500/10 text-danger-300',
  quest: 'border-quest-600/50 bg-quest-500/10 text-quest-300',
  neutral: 'border-iron-700 bg-wood-950/60 text-wood-300',
}

export function Chip({ tono = 'neutral', mono = false, children, title }: { tono?: TonoChip; mono?: boolean; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-2xs ${mono ? 'font-mono tabular-nums' : ''} ${TONO[tono]}`}>
      {children}
    </span>
  )
}
