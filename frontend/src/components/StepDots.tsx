/// Indicador visual del flujo de 3 pasos (mundo → personaje → partida): pasos completados
/// como remaches encendidos, el actual como gema de cristal, los futuros como hierro apagado.
/// Puramente decorativo — el texto "Paso X de 3" de cada página sigue siendo el accesible.
export function StepDots({ current }: { current: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden>
      {([1, 2, 3] as const).map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          {s === current ? (
            <span className="gem" />
          ) : s < current ? (
            <span className="h-2 w-2 rounded-full bg-accent-600 shadow-[0_0_5px_color-mix(in_srgb,var(--color-accent-500)_50%,transparent)]" />
          ) : (
            <span className="h-2 w-2 rounded-full border border-iron-700 bg-iron-800" />
          )}
          {s < 3 && <span className={`h-px w-5 ${s < current ? 'bg-accent-600/50' : 'bg-iron-700'}`} />}
        </span>
      ))}
    </span>
  )
}
