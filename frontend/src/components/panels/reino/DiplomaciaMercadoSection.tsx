import { useEffect, useState } from 'react'
import type { AlmacenItemInfo, CompanionInfo } from '../../../types'
import type { DiplomaciaResultado, EnciclopediaFaccionInfo, MercadoItemInfo } from '../../../lib/api'
import { getMercado, postDiplomacia, postMercadoComprar, postMercadoVender } from '../../../lib/api'
import { PanelEmptyState } from '../../PanelEmptyState'
import { PanelSection } from '../../PanelSection'
import { razaThemeStyleVars } from '../../../lib/razaTheme'

// Bandas de FactionRelation (0-100, 50=neutro) — mismo lenguaje visual que REPUTATION_BANDS de
// ReputacionPanel.tsx (banda con nombre + color), pero sobre un `type`/escala distintos: aquí la
// escala real es la que ya define factionRelations.ts (backend), no se reinventa aquí.
const RELATION_LABEL: Record<NonNullable<DiplomaciaResultado['type']>, string> = {
  ALIANZA: 'Alianza',
  TRATADO_COMERCIAL: 'Tratado comercial',
  NEUTRAL: 'Neutral',
  TENSION: 'Tensión',
  GUERRA: 'Guerra',
}

const RELATION_TONE: Record<NonNullable<DiplomaciaResultado['type']>, string> = {
  ALIANZA: 'text-accent-300',
  TRATADO_COMERCIAL: 'text-moss-400',
  NEUTRAL: 'text-wood-300',
  TENSION: 'text-cost-400',
  GUERRA: 'text-danger-400',
}

interface DiplomaciaMercadoSectionProps {
  saveId: string
  companions: CompanionInfo[]
  factions: EnciclopediaFaccionInfo[]
  goirnos: number
  onRefreshSave: () => Promise<void>
  /// B27 (pruebas 2026-09-28) — objetos del Almacén propio, para Vender en el Mercado.
  almacenItems?: AlmacenItemInfo[]
}

/// Sub-tab "Diplomacia y Mercado" del Reino (Fase 3, 2026-09-21, docs/rpgtarkor/mundo-vivo-x4.md
/// § 4.4) — las 3 acciones de diplomacia (Negociar/Sabotear/Espiar) y el mercado regulado ya
/// funcionaban en backend, pero sin ningún cliente hasta ahora. Selector de facción objetivo con
/// `razaThemeStyleVars` en el borde — primera aplicación real de la paleta por raza (§ 0.1 del plan).
export function DiplomaciaMercadoSection({ saveId, companions, factions, goirnos, onRefreshSave, almacenItems = [] }: DiplomaciaMercadoSectionProps) {
  const [targetSlug, setTargetSlug] = useState<string | null>(null)
  // Bug real (verificación en vivo, 2026-09-21): `factions` trae catálogo NPC + la fundada por el
  // propio jugador en esta partida (`buildFactionsSection`, backend) — y esa propia facción SIEMPRE
  // sale `discovered: true` (se le hace `DiscoveredEntity.create` al fundarla, reino.ts). Sin este
  // filtro, el Reino propio se colaba como objetivo de Negociar/Sabotear/Espiar/Mercado contra uno
  // mismo. Slug determinista `${slugify(kingdomName)}-${saveId}` (reino.ts) — mismo criterio para
  // reconocerla y excluirla, sin pedir un campo nuevo al backend.
  const descubiertas = factions.filter((f) => f.discovered && !f.slug.endsWith(`-${saveId}`))
  const diplomatico = companions.find((c) => c.rolReino === 'diplomatico')
  const target = descubiertas.find((f) => f.slug === targetSlug) ?? null
  // Contador de refresco de Mercado tras negociar con éxito (ver comentario largo en
  // `DiplomaciaCard.onNegociarExito` más abajo) — cambiar de valor es lo único que le importa al
  // `useEffect` de `MercadoCard`, mismo patrón que `refetchToken` de `useEnciclopedia.ts`.
  const [mercadoRefreshToken, setMercadoRefreshToken] = useState(0)

  if (descubiertas.length === 0) {
    return (
      <PanelEmptyState
        icon="🤝"
        title="Sin facciones descubiertas todavía"
        hint="Descubre alguna facción en el mundo (hablando con sus NPC o visitando su territorio) para poder negociar o comerciar con ella."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelSection title="Facción objetivo">
        <div className="flex flex-wrap gap-1.5">
          {descubiertas.map((f) => (
            <button
              type="button"
              key={f.slug}
              onClick={() => setTargetSlug(f.slug === targetSlug ? null : f.slug)}
              style={razaThemeStyleVars(f.raza)}
              className={`tactile rounded-lg border px-3 py-1.5 text-left text-xs transition-colors ${
                f.slug === targetSlug
                  ? 'border-[var(--raza-border,var(--color-accent-600))] bg-[var(--raza-border,var(--color-accent-600))]/10 text-[var(--raza-text,var(--color-accent-300))]'
                  : 'border-iron-700 bg-wood-950/40 text-wood-300 hover:border-[var(--raza-border,var(--color-accent-600))]/60'
              }`}
            >
              <p className="font-medium">{f.name}</p>
              <p className="text-2xs text-wood-500">{f.liderNpc ? `Liderada por ${f.liderNpc.name}` : f.raza}</p>
            </button>
          ))}
        </div>
      </PanelSection>

      {target && (
        <>
          <DiplomaciaCard saveId={saveId} target={target} diplomatico={diplomatico} onNegociarExito={() => setMercadoRefreshToken((t) => t + 1)} />
          <MercadoCard saveId={saveId} target={target} goirnos={goirnos} onRefreshSave={onRefreshSave} refreshToken={mercadoRefreshToken} almacenItems={almacenItems} />
        </>
      )}
    </div>
  )
}

function DiplomaciaCard({
  saveId,
  target,
  diplomatico,
  onNegociarExito,
}: {
  saveId: string
  target: EnciclopediaFaccionInfo
  diplomatico: CompanionInfo | undefined
  /// Bug real (verificación en vivo, 2026-09-21): `DiplomaciaCard`/`MercadoCard` son hermanos, cada
  /// uno con su propio estado — tras negociar con éxito ("Maktor y Clan Serhu mantienen un tratado
  /// comercial estable"), Mercado seguía mostrando "Negocia un tratado primero" porque nada
  /// disparaba su refetch. Avisa al padre solo cuando `accion === 'negociar'` tiene éxito (sabotear/
  /// espiar no cambian si hay tratado o no, ver `verificaTratadoComercial` en backend).
  onNegociarExito: () => void
}) {
  const [resultado, setResultado] = useState<DiplomaciaResultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'negociar' | 'sabotear' | 'espiar' | null>(null)

  // Reinicia el resultado mostrado al cambiar de facción objetivo — un resultado de otra facción
  // quedándose en pantalla sería engañoso.
  useEffect(() => {
    setResultado(null)
    setError(null)
  }, [target.slug])

  async function handleAccion(accion: 'negociar' | 'sabotear' | 'espiar') {
    if (!diplomatico) return
    setBusy(accion)
    setError(null)
    try {
      const res = await postDiplomacia(saveId, { companionId: diplomatico.id, targetFactionSlug: target.slug, accion })
      setResultado(res)
      if (accion === 'negociar') onNegociarExito()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <PanelSection title="Diplomacia">
      {!diplomatico ? (
        <p className="text-xs text-wood-500">
          Asigna a un compañero el rol de diplomático (rolReino: "diplomatico") en Súbditos para poder negociar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-2xs text-wood-500">Diplomático: {diplomatico.name}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleAccion('negociar')}
              disabled={busy !== null}
              className="tactile flex-1 rounded-lg border border-accent-600/60 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10 disabled:opacity-50"
            >
              {busy === 'negociar' ? '…' : 'Negociar'}
            </button>
            <button
              type="button"
              onClick={() => handleAccion('sabotear')}
              disabled={busy !== null}
              className="tactile flex-1 rounded-lg border border-danger-600/60 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-danger-400 transition-colors hover:bg-danger-500/10 disabled:opacity-50"
            >
              {busy === 'sabotear' ? '…' : 'Sabotear'}
            </button>
            <button
              type="button"
              onClick={() => handleAccion('espiar')}
              disabled={busy !== null}
              className="tactile flex-1 rounded-lg border border-iron-700 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/40 disabled:opacity-50"
            >
              {busy === 'espiar' ? '…' : 'Espiar'}
            </button>
          </div>
          {error && <p className="text-2xs text-danger-400">{error}</p>}
          {resultado && (
            <div className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
              {resultado.type && (
                <p className={`text-2xs font-bold uppercase tracking-wide ${RELATION_TONE[resultado.type]}`}>{RELATION_LABEL[resultado.type]}</p>
              )}
              {resultado.hechoDeMundo && <p className="mt-1 text-xs leading-relaxed text-wood-300">{resultado.hechoDeMundo}</p>}
              {resultado.accion === 'espiar' && !resultado.hechoDeMundo && (
                <p className="mt-1 text-xs leading-relaxed text-wood-400">Presión: {resultado.presion} / 100</p>
              )}
            </div>
          )}
        </div>
      )}
    </PanelSection>
  )
}

// Comprar (Fase 3, 2026-09-21) + Vender (B27, pruebas 2026-09-28: era la única vía de ingresos y
// no tenía UI) — Vender lista los objetos del Almacén propio con `catalogSlug` (el backend rechaza
// los que no tienen valor de mercado con un mensaje propio, que se muestra tal cual).
function MercadoCard({
  saveId,
  target,
  goirnos,
  onRefreshSave,
  refreshToken,
  almacenItems,
}: {
  saveId: string
  target: EnciclopediaFaccionInfo
  goirnos: number
  onRefreshSave: () => Promise<void>
  almacenItems: AlmacenItemInfo[]
  /// Ver comentario en `DiplomaciaCard.onNegociarExito` — cambiar de valor repite el fetch aunque
  /// `target.slug` no haya cambiado (negociar con la MISMA facción ya seleccionada).
  refreshToken: number
}) {
  const [mercado, setMercado] = useState<{ tratado: boolean; items: MercadoItemInfo[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const vendibles = almacenItems.filter((i) => i.catalogSlug)

  async function reload() {
    const res = await getMercado(saveId, target.slug)
    setMercado(res)
  }

  useEffect(() => {
    let cancelado = false
    setMercado(null)
    getMercado(saveId, target.slug)
      .then((res) => {
        if (!cancelado) setMercado(res)
      })
      .catch(() => {
        if (!cancelado) setMercado({ tratado: false, items: [] })
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveId, target.slug, refreshToken])

  async function handleComprar(almacenItemId: string) {
    setBusy(almacenItemId)
    try {
      await postMercadoComprar(saveId, target.slug, almacenItemId)
      await reload()
      await onRefreshSave()
    } finally {
      setBusy(null)
    }
  }

  async function handleVender(almacenItemId: string) {
    setBusy(almacenItemId)
    setErrorVenta(null)
    try {
      await postMercadoVender(saveId, target.slug, almacenItemId)
      await reload()
      await onRefreshSave()
    } catch (e) {
      setErrorVenta(e instanceof Error ? e.message : 'No se pudo vender.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <PanelSection title="Mercado">
      {mercado === null ? (
        <p className="text-xs text-wood-500">Consultando…</p>
      ) : !mercado.tratado ? (
        <p className="text-xs text-wood-500">Negocia un tratado comercial con {target.name} primero (botón Negociar arriba).</p>
      ) : mercado.items.length === 0 ? (
        <p className="text-xs text-wood-500">{target.name} no tiene nada que vender ahora mismo.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {mercado.items.map((item) => (
            <div key={item.almacenItemId} className="flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
              <span className="flex-1 truncate text-xs text-wood-200">{item.name}</span>
              <span className="text-2xs text-wood-500">×{item.stock}</span>
              <span className={`font-mono text-xs tabular-nums ${goirnos < item.precio ? 'text-danger-400' : 'text-cost-400'}`}>{item.precio} G</span>
              <button
                type="button"
                onClick={() => handleComprar(item.almacenItemId)}
                disabled={busy === item.almacenItemId || goirnos < item.precio}
                className="tactile shrink-0 rounded border border-accent-600/60 px-2 py-1 text-2xs text-accent-300 hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === item.almacenItemId ? '...' : 'Comprar'}
              </button>
            </div>
          ))}
        </div>
      )}
      {mercado?.tratado && (
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-wood-500">Vender de tu Almacén</p>
          {errorVenta && <p className="text-2xs text-danger-400">{errorVenta}</p>}
          {vendibles.length === 0 ? (
            <p className="text-xs text-wood-500">No tienes nada en el Almacén que se pueda vender.</p>
          ) : (
            vendibles.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
                <span className="flex-1 truncate text-xs text-wood-200">{item.name}</span>
                <button
                  type="button"
                  onClick={() => handleVender(item.id)}
                  disabled={busy === item.id}
                  className="tactile shrink-0 rounded border border-accent-600/60 px-2 py-1 text-2xs text-accent-300 hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === item.id ? '...' : 'Vender'}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </PanelSection>
  )
}
