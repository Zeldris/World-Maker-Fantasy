// Generalizado (sesión de diseño 2026-07-23, atributos secundarios de PJ) — antes acoplado a
// `attributeLabels`/max=18 fijos; ahora acepta cualquier bloque de atributos con sus propias
// etiquetas, para reutilizarlo tal cual con los 9 atributos secundarios (EstadisticasPanel.tsx).
//
// `colors` (2026-07-30, petición explícita: "que cada barra tenga su color de attr") — opcional:
// sin él, cada barra sigue usando el degradado accent uniforme de siempre (atributos secundarios,
// que no tienen un color propio en el sistema — ver `attributeColorClasses`, dice.ts). Con él
// (atributos jugables), cada fila se tiñe con SU color real, mismo sistema ya usado para el punto
// de color de las habilidades en CombatPanel.tsx — coherencia visual entre paneles.
export function AttributeBars({
  attributes,
  labels,
  max = 18,
  colors,
}: {
  attributes: Record<string, number>
  labels: Record<string, string>
  max?: number
  colors?: Record<string, { text: string; dot: string }>
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {Object.keys(attributes).map((key) => {
        const value = attributes[key]
        const color = colors?.[key]
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-wood-300">{labels[key]}</span>
              <span className={`font-mono tabular-nums ${color ? color.text : 'text-accent-300'}`}>{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-iron-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
              <div
                className={
                  color
                    ? `h-full rounded-full ${color.dot} transition-[width] duration-500`
                    : 'h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent-500)_45%,transparent)] transition-[width] duration-500'
                }
                style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
