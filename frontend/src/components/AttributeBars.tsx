// Generalizado (sesión de diseño 2026-07-23, atributos secundarios de PJ) — antes acoplado a
// `attributeLabels`/max=18 fijos; ahora acepta cualquier bloque de atributos con sus propias
// etiquetas, para reutilizarlo tal cual con los 9 atributos secundarios (EstadisticasPanel.tsx).
export function AttributeBars({
  attributes,
  labels,
  max = 18,
}: {
  attributes: Record<string, number>
  labels: Record<string, string>
  max?: number
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {Object.keys(attributes).map((key) => {
        const value = attributes[key]
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-wood-300">{labels[key]}</span>
              <span className="font-mono tabular-nums text-accent-300">{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-iron-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent-500)_45%,transparent)] transition-[width] duration-500"
                style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
