import { ModalShell } from './ModalShell'

// CFG-3 (hito 0.2, roadmap-front.md § 2.1) — menú de pausa dentro de la partida: Reanudar ·
// Configuración · Salir a tus partidas · Salir al inicio. Sustituye al «← Salir a tus partidas» de
// la cabecera y a su confirmación: el propio menú es el paso deliberado. La partida se guarda sola
// en cada turno, así que salir no pierde nada; si hay algo en curso, se avisa (canDo 'salir').

interface MenuPausaProps {
  /// Aviso de salida (p. ej. «El narrador está escribiendo: lo que cuente se guardará igualmente.»).
  aviso: string | null
  onReanudar: () => void
  onConfiguracion: () => void
  onSalirPartidas: () => void
  onSalirInicio: () => void
}

export function MenuPausa({ aviso, onReanudar, onConfiguracion, onSalirPartidas, onSalirInicio }: MenuPausaProps) {
  const opcion =
    'tactile flex w-full items-center gap-3 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2.5 text-left text-sm text-wood-200 transition-colors hover:border-accent-600/60 hover:text-accent-200'
  const numero = (n: number) => (
    <span aria-hidden="true" className="font-mono text-xs text-wood-500">
      {n}
    </span>
  )
  return (
    <ModalShell title="Pausa" subtitle="Tu progreso se guarda solo en cada turno." icon="⏸" tamano="sm" onClose={onReanudar}>
      <div className="flex flex-col gap-2">
        <button type="button" data-opcion onClick={onReanudar} className={opcion}>
          {numero(1)} Reanudar
        </button>
        <button type="button" data-opcion onClick={onConfiguracion} className={opcion}>
          {numero(2)} Configuración
        </button>
        <button type="button" data-opcion onClick={onSalirPartidas} className={opcion}>
          {numero(3)} Salir a tus partidas
        </button>
        <button type="button" data-opcion onClick={onSalirInicio} className={opcion}>
          {numero(4)} Salir al inicio
        </button>
      </div>
      {aviso && <p className="text-2xs text-accent-300">⚠️ {aviso}</p>}
    </ModalShell>
  )
}
