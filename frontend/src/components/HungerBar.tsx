// Habilidad "Comer/Beber" (2026-09-04) — mismo cascarón compacto que EnergyBar.tsx, junto a la
// que se monta en el HUD persistente. A diferencia de energía (gradiente fijo), colorea por
// umbral igual que ResourceBar (EstadisticasPanel.tsx): rojo <25%, ámbar <50%, verde resto — para
// que la carencia real salte a la vista sin tener que leer el número.
function barColor(pct: number): string {
  if (pct < 25) return 'from-danger-600 to-danger-400'
  if (pct < 50) return 'from-cost-600 to-cost-400'
  return 'from-moss-600 to-moss-400'
}

export function HungerBar({ hambre }: { hambre: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(hambre)))
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-iron-700 bg-wood-950/60 px-2.5 py-1">
      <span aria-hidden="true" className="text-xs">
        🍖
      </span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-iron-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
        <div className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ${barColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono tabular-nums text-2xs text-wood-400">{pct}%</span>
    </div>
  )
}
