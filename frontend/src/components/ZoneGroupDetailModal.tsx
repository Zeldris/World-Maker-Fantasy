import type { ZonePointInfo } from '../lib/api'
import { SelectionModalShell } from './SelectionModalShell'
import { ZonePointDetailBody } from './ZonePointDetailModal'

/// Compañero de fauna con nombre propio en el mismo punto que su dueño (auditoría de lore
/// 2026-09-13, C10 — petición explícita: "los compañeros de npc deben formar un mismo punto en el
/// mapa de zona... quizás añadimos un icono nuevo para los grupos... en los cuales saca un modal
/// donde se desglosa que hay en el grupo"). El dueño sigue siendo el `ZonePoint` real (única
/// posición que se mueve por la cuadrícula); el companion nunca tiene punto propio — el backend lo
/// cuelga del dueño (`ZonePointInfo.companion`, ver zona.ts). Este modal sustituye a
/// `ZonePointDetailModal` SOLO cuando el punto clicado tiene `companion`, listando ambas entidades.
export function ZoneGroupDetailModal({ point, onClose }: { point: ZonePointInfo; onClose: () => void }) {
  const companion = point.companion!

  return (
    <SelectionModalShell title={`${point.nombre} y su compañero`} onCancel={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-wood-500">{point.nombre}</p>
          <ZonePointDetailBody point={{ targetSlug: point.targetSlug, nombre: point.nombre, tipo: point.tipo, color: point.color, descubierto: point.descubierto }} />
        </div>
        <div className="border-t border-iron-800 pt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-wood-500">{companion.nombre}</p>
          <ZonePointDetailBody point={{ targetSlug: companion.slug, nombre: companion.nombre, tipo: 'FAUNA', color: point.color, descubierto: point.descubierto }} />
        </div>
      </div>
    </SelectionModalShell>
  )
}
