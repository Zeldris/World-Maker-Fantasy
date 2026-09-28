import type { ZonePointInfo, ZonaDinamicoInfo } from '../lib/api'
import { useEnciclopediaLink } from '../context/useEnciclopediaLink'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'

/// Tipos de pin del mapa de Zona — `ZonePointInfo` (catálogo) + los que solo existen como dinámicos
/// de la partida: OBJETO (tirado al suelo) y CADAVER (Fase 5, 2026-09-28).
export type ZonaPinTipo = ZonePointInfo['tipo'] | 'OBJETO' | 'CADAVER'

const TIPO_LABEL: Record<ZonaPinTipo, string> = {
  FAUNA: 'Fauna',
  RECURSO: 'Recurso',
  NPC: 'NPC',
  EDIFICIO: 'Edificio',
  // "Tirar" objetos al suelo de la Zona (2026-09-06, hallazgo 8) — único `tipo` que no viene de
  // `ZonePointInfo` (catálogo fijo): instancia por partida, `dinamicos` únicamente.
  OBJETO: 'Objeto en el suelo',
  CADAVER: 'Cadáver',
}

const COLOR_LABEL: Record<ZonePointInfo['color'], string> = {
  ALIADO: 'Aliado',
  NEUTRO: 'Neutro',
  ENEMIGO: 'Enemigo',
  SIN_FACCION: 'Sin facción',
  // No aplica facción por diseño (2026-09-09) — RECURSO/OBJETO, nunca "sin facción por ahora"
  // (SIN_FACCION) como un NPC/FAUNA/EDIFICIO independiente, ver zonePointColorFor (backend).
  INERTE: 'Salvaje',
}

/// Punto del jugador en el mapa de Zona (2026-09-04) — este modal ahora también se abre desde un
/// pin `dinamicos` (NPC/fauna sin `ZonePoint` sembrado, `slug`/`targetSlug` es el mismo concepto
/// con nombre distinto). Shape mínimo común a ambas fuentes, sin exigir campos que solo tiene una
/// de las dos (`ZonePointInfo.id`/`cantidad`).
type ZonePointDetailSource = {
  targetSlug: string
  nombre: string
  tipo: ZonaPinTipo
  color: ZonePointInfo['color']
  cantidad?: number
  /// "Tirar" objetos al suelo de la Zona (2026-09-06) — solo presente cuando `tipo === 'OBJETO'`.
  droppedItemId?: string
  /// Cadáveres en el mapa (Fase 5, 2026-09-28) — solo presente cuando `tipo === 'CADAVER'`.
  cadaver?: { npcSlug: string; nombre: string; saqueable: boolean; desollable: boolean }
  /// Hallazgo 34 (revisar-partida-hallazgos.md 2026-09-07) — false si la partida todavía no
  /// descubrió esto en la ficción; oculta "Ver en la Enciclopedia" aunque exista ficha real.
  descubierto: boolean
}

export function zonaDinamicoToDetailSource(d: ZonaDinamicoInfo): ZonePointDetailSource {
  return { targetSlug: d.slug, nombre: d.nombre, tipo: d.tipo, color: d.color, droppedItemId: d.droppedItemId, cadaver: d.cadaver, descubierto: d.descubierto }
}

/// Cuerpo compartido de "badges + estado de descubrimiento/enciclopedia" (auditoría de lore
/// 2026-09-13, C10 — extraído para `ZoneGroupDetailModal.tsx`, que necesita renderizar este mismo
/// bloque dos veces, una por entidad del grupo, sin duplicar el JSX).
export function ZonePointDetailBody({ point }: { point: ZonePointDetailSource }) {
  const { enciclopediaIndex, onEntityDetail } = useEnciclopediaLink()
  const target = enciclopediaIndex.bySlugKey.get(`fauna:${point.targetSlug}`) ?? enciclopediaIndex.bySlugKey.get(`npc:${point.targetSlug}`)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 text-2xs">
        <span className="rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400">{TIPO_LABEL[point.tipo]}</span>
        <span className="rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400">{COLOR_LABEL[point.color]}</span>
        {!!point.cantidad && point.cantidad > 1 && <span className="rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400">×{point.cantidad}</span>}
      </div>
      {!point.descubierto ? (
        <p className="text-xs italic text-wood-500">Todavía no lo has descubierto en la partida.</p>
      ) : target ? (
        <button type="button" onClick={() => onEntityDetail?.(target)} className="self-start text-xs text-accent-400 underline decoration-dotted underline-offset-2 hover:text-accent-300">
          Ver en la Enciclopedia
        </button>
      ) : (
        <p className="text-xs italic text-wood-500">Todavía sin ficha propia en la Enciclopedia.</p>
      )}
    </div>
  )
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
export function ZonePointDetailModal({
  point,
  onClose,
  onRecoger,
  onIrHasta,
  onSaquear,
  onDesollar,
}: {
  point: ZonePointDetailSource
  onClose: () => void
  /// B3 (pruebas 2026-09-28): pulsar un pin abría su ficha sin forma de llegar hasta él — el
  /// mapa de movimiento pasa aquí cómo caminar hasta el pin (ausente en la vista informativa).
  onIrHasta?: () => void
  /// Cadáveres en el mapa (Fase 5, 2026-09-28) — el caller camina hasta el cadáver si hace falta
  /// y abre el modal real de Saquear/Desollar.
  onSaquear?: (npcSlug: string) => void
  onDesollar?: (npcSlug: string) => void
  /// "Tirar" objetos al suelo de la Zona (2026-09-06, hallazgo 8) — mismo criterio opcional que el
  /// resto de callbacks de acción de este proyecto (`onUnequip`/`onEquip` en DetailModal.tsx).
  onRecoger?: (droppedItemId: string) => Promise<void>
}) {
  const { enciclopediaIndex, onEntityDetail } = useEnciclopediaLink()
  const target = enciclopediaIndex.bySlugKey.get(`fauna:${point.targetSlug}`) ?? enciclopediaIndex.bySlugKey.get(`npc:${point.targetSlug}`)

  return (
    <SelectionModalShell
      title={point.nombre}
      onCancel={onClose}
      cancelLabel="Cerrar"
      footer={
        <>
          {point.tipo === 'CADAVER' && point.cadaver?.saqueable && onSaquear && (
            <button type="button" onClick={() => { onSaquear(point.cadaver!.npcSlug); onClose() }} className={confirmButtonClasses('accent')}>
              Saquear
            </button>
          )}
          {point.tipo === 'CADAVER' && point.cadaver?.desollable && onDesollar && (
            <button type="button" onClick={() => { onDesollar(point.cadaver!.npcSlug); onClose() }} className={confirmButtonClasses('accent')}>
              Desollar
            </button>
          )}
          {point.tipo !== 'CADAVER' && onIrHasta && (
            <button type="button" onClick={() => { onIrHasta(); onClose() }} className={confirmButtonClasses('accent')}>
              Ir hasta aquí
            </button>
          )}
          {point.tipo === 'OBJETO' && point.droppedItemId && (
            <button
              type="button"
              onClick={async () => { await onRecoger?.(point.droppedItemId!); onClose() }}
              className={confirmButtonClasses('accent')}
            >
              Recoger
            </button>
          )}
          {/* Hallazgo 34 — el botón exige `target` (ficha real) Y `descubierto` (la partida ya lo
              encontró en la ficción); sin esto último, ofrecer el link filtraría información de
              algo que el jugador aún no ha descubierto, solo por verlo marcado en el mapa. */}
          {target && point.descubierto && (
            <button type="button" onClick={() => { onEntityDetail?.(target); onClose() }} className={confirmButtonClasses('accent')}>
              Ver en la Enciclopedia
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5 text-2xs">
        <span className="rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400">{TIPO_LABEL[point.tipo]}</span>
        <span className="rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400">{COLOR_LABEL[point.color]}</span>
        {!!point.cantidad && point.cantidad > 1 && <span className="rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400">×{point.cantidad}</span>}
      </div>
      {!point.descubierto ? (
        <p className="text-xs italic text-wood-500">Todavía no lo has descubierto en la partida.</p>
      ) : (
        !target && <p className="text-xs italic text-wood-500">Todavía sin ficha propia en la Enciclopedia.</p>
      )}
    </SelectionModalShell>
  )
}
