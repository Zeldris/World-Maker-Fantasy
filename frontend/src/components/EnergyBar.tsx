// Sistema de fatiga (2026-07-29) — barra de energía junto a la de salud en la barra de estado
// persistente de CombatPanel.tsx. A diferencia de HealthBar, cambia casi cada turno (gasto/regen
// normal del combate, no solo un golpe) — sin el flash/shake de "recibiste daño", solo el número.
export function EnergyBar({ energia, energiaMax }: { energia: number; energiaMax: number }) {
  const pct = energiaMax > 0 ? Math.round((energia / energiaMax) * 100) : 0
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-iron-700 bg-wood-950/60 px-2.5 py-1">
      <span aria-hidden="true" className="text-xs">
        ⚡
      </span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-iron-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent2-600 to-accent2-400 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono tabular-nums text-2xs text-wood-400">
        {energia}/{energiaMax}
      </span>
    </div>
  )
}
