import type { ReactNode } from 'react'

// Cabecera de sección compartida (roadmap de diseño CSS, Fable 2026-07-20): antes este markup
// (título uppercase + hairline) estaba copiado byte a byte en 6 archivos — extraído aquí a
// partir del `Section` local que ya tenía `ReinoPanel.tsx`, mismo patrón que `PanelEmptyState`.
export function PanelSection({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-400">{title}</p>
        <span className="h-px flex-1 bg-iron-700" />
      </div>
      {children}
    </div>
  )
}
