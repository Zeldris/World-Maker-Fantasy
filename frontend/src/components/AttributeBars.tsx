import { TooltipAnchor } from './TooltipAnchor'

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
  bonuses,
  labels,
  max = 18,
  colors,
}: {
  attributes: Record<string, number>
  /// Bonus de equipo por atributo, SIN sumar la base (2026-08-14, petición explícita: "la barra
  /// debería verse en color claro la parte de los attr base y en más oscuro lo que aumentan lo
  /// que llevas equipado", con tooltip al pasar el ratón). Opcional: sin él, cada barra se pinta
  /// de un solo tramo como siempre (atributos secundarios, que no separan base/equipo).
  bonuses?: Record<string, number>
  labels: Record<string, string>
  max?: number
  colors?: Record<string, { text: string; dot: string; dotLight?: string }>
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {Object.keys(attributes).map((key) => {
        const base = attributes[key]
        const bonus = bonuses?.[key] ?? 0
        const total = base + bonus
        const color = colors?.[key]
        // Presente en TODAS las barras que separan base/equipo, incluso sin bonus (petición
        // explícita, 2026-08-14: "aunque no tenga el aumento de item... pondrá Equipo: 0") — pero
        // solo cuando el caller pasó `bonuses` de verdad (atributos jugables). Los atributos
        // secundarios no lo pasan: su valor YA es el efectivo con equipo incluido (ver
        // `effectiveSecondaryAttributes`), así que "Base: X" ahí sería falso, no solo redundante.
        const tooltip = bonuses !== undefined ? `Base: ${base} · Equipo: ${bonus > 0 ? '+' : ''}${bonus}` : undefined
        // Escala dinámica (bug real, 2026-08-14: con la base ya en el tope de 18 puntos gastables
        // — el equipo NO tiene ese tope — el tramo de bonus quedaba invisible del todo, porque
        // tanto `base` como `total` se recortaban al mismo 100% con `max` fijo). Si el total supera
        // `max`, la barra entera se reescala a `total` para que los dos tramos sigan siendo
        // proporcionales y visibles, en vez de recortarse en silencio.
        const barMax = Math.max(max, total)
        const baseWidth = (base / barMax) * 100
        const bonusWidth = Math.max(0, (bonus / barMax) * 100)
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-wood-300">{labels[key]}</span>
              <span className={`font-mono tabular-nums ${color ? color.text : 'text-accent-300'}`}>{total}</span>
            </div>
            <TooltipAnchor text={tooltip} className="block">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-iron-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
                <div
                  className={
                    color
                      ? `h-full ${color.dotLight ?? color.dot} transition-[width] duration-500`
                      : 'h-full bg-gradient-to-r from-accent-600 to-accent-400 shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent-500)_45%,transparent)] transition-[width] duration-500'
                  }
                  style={{ width: `${baseWidth}%` }}
                />
                {bonus !== 0 && (
                  <div
                    className={color ? `h-full ${color.dot} transition-[width] duration-500` : 'h-full bg-accent-600'}
                    style={{ width: `${bonusWidth}%` }}
                  />
                )}
              </div>
            </TooltipAnchor>
          </div>
        )
      })}
    </div>
  )
}
