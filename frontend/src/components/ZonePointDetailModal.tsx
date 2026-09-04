import type { ZonePointInfo } from '../lib/api'
import { useEnciclopediaLink } from '../context/useEnciclopediaLink'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

const TIPO_LABEL: Record<ZonePointInfo['tipo'], string> = {
  FAUNA: 'Fauna',
  RECURSO: 'Recurso',
  NPC: 'NPC',
  EDIFICIO: 'Edificio',
}

const COLOR_LABEL: Record<ZonePointInfo['color'], string> = {
  ALIADO: 'Aliado',
  NEUTRO: 'Neutro',
  ENEMIGO: 'Enemigo',
  SIN_FACCION: 'Sin facción',
}

/// Modal de detalle de un pin de Zona (2026-09-04, petición explícita jugando en vivo: "teniendo
/// tanta zona estas montando uno sobre otros... cuesta saber solo con ese texto que hay" — el
/// único feedback que daba un pin hasta ahora era el `<title>` nativo del SVG, un tooltip por hover
/// poco fiable y sin ninguna acción). Idea ya anotada antes de implementarse
/// (`tarkor_idea_modal_zonepoint_2026-09-02`).
///
/// `targetSlug`/`tipo` no bastan solos para saber si un pin tiene ficha en la Enciclopedia: FAUNA/
/// NPC/RECURSO comparten el mismo slug de catálogo (`Npc`/fuente) pero vive indexado bajo
/// `entityType` distinto según de qué lista de `EnciclopediaResponse` salga (`npcs` → 'npc',
/// `faunaFlora` → 'fauna', ver enciclopediaIndex.ts) — probar ambas claves en `bySlugKey` en vez de
/// derivar el `entityType` a mano desde `ZonePointInfo.tipo` evita duplicar esa clasificación aquí
/// (que ya vive en el backend, `zona.ts`/`worldCatalog.ts`, y no siempre coincide 1:1: un punto
/// FAUNA visual puede corresponder a un `Npc.kind==='PRINCIPAL'`, indexado como 'npc'). EDIFICIO
/// nunca tiene ficha propia (gobernado por `Building`/`construction.ts`, fuera de alcance de la
/// Enciclopedia) — sin target resuelto, el botón simplemente no aparece, en vez de fingir un enlace
/// que no lleva a ningún sitio.
export function ZonePointDetailModal({ point, onClose }: { point: ZonePointInfo; onClose: () => void }) {
  const { enciclopediaIndex, onEntityDetail } = useEnciclopediaLink()
  const target = enciclopediaIndex.bySlugKey.get(`fauna:${point.targetSlug}`) ?? enciclopediaIndex.bySlugKey.get(`npc:${point.targetSlug}`)

  return (
    <SelectionModalShell
      title={point.nombre}
      onCancel={onClose}
      footer={
        target && (
          <button type="button" onClick={() => { onEntityDetail?.(target); onClose() }} className={confirmButtonClasses('accent')}>
            Ver en la Enciclopedia
          </button>
        )
      }
    >
      <div className="flex flex-wrap gap-1.5 text-2xs">
        <span className="rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400">{TIPO_LABEL[point.tipo]}</span>
        <span className="rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400">{COLOR_LABEL[point.color]}</span>
        {point.cantidad > 1 && <span className="rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400">×{point.cantidad}</span>}
      </div>
      {!target && <p className="text-xs italic text-wood-500">Todavía sin ficha propia en la Enciclopedia.</p>}
    </SelectionModalShell>
  )
}
