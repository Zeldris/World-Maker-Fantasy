// Colapsar los logs (2026-08-14, petición explícita: "que pueda colapsar el log de personaje a
// la izquierda y que el de mundo ocupe todo... y al revés... lo mismo con las de combate") —
// tira estrecha que sustituye a LogPanel/CombatPanel cuando ese lado está colapsado, para que el
// otro ocupe todo el ancho disponible. Mismo `plank-panel` que el panel al que sustituye, para
// que no desentone visualmente al aparecer/desaparecer.
export function CollapsedRail({
  label,
  icon,
  accentClass,
  onExpand,
}: {
  label: string
  icon: string
  accentClass: string
  onExpand: () => void
}) {
  return (
    <button type="button"
      onClick={onExpand}
      title={`Mostrar "${label}"`}
      className="tactile plank-panel flex w-9 flex-col items-center justify-center gap-3 rounded-xl border border-iron-800 py-4 transition-colors hover:border-accent-600/60"
    >
      <span aria-hidden="true" className={`text-sm ${accentClass}`}>
        {icon}
      </span>
      <span className={`font-serif text-2xs tracking-wide ${accentClass}`} style={{ writingMode: 'vertical-rl' }}>
        {label}
      </span>
    </button>
  )
}
