import { useEffect, useState } from 'react'
import type { AlmacenItemInfo, CompanionInfo } from '../../../types'
import type { DiplomaciaResultado, EnciclopediaFaccionInfo, MercadoItemInfo, VasallajeInfo } from '../../../lib/api'
import { getMercado, getVasallajes, postDiplomacia, postMercadoComprar, postMercadoVender } from '../../../lib/api'
import { PanelEmptyState } from '../../PanelEmptyState'
import { PanelSection } from '../../PanelSection'
import { razaThemeStyleVars } from '../../../lib/razaTheme'
import { ErrorBanner } from '../../../components/ErrorBanner'
import { useErrorConReintento } from '../../../hooks/useErrorConReintento'
import { Esqueleto } from '../../Esqueleto'
import { useModoConsulta } from '../../../context/useModoConsulta'

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

/// Sub-tab "Diplomacia y Mercado" del Reino (Fase 3, 2026-09-21, docs/rpgtarkor/sistemas-reino/mundo-vivo-x4.md
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
  // P286: vasallajes del mundo (quién debe a quién y cuánto); un fallo no tapa el resto de la pestaña.
  const [vasallajes, setVasallajes] = useState<VasallajeInfo[]>([])
  useEffect(() => {
    let cancelado = false
    getVasallajes(saveId).then((r) => { if (!cancelado) setVasallajes(r.vasallajes) }).catch(() => { if (!cancelado) setVasallajes([]) })
    return () => { cancelado = true }
  }, [saveId])

  if (descubiertas.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {vasallajes.length > 0 && <VasallajesCard vasallajes={vasallajes} />}
        <PanelEmptyState
          icon="🤝"
          title="Sin facciones descubiertas todavía"
          hint="Descubre alguna facción en el mundo (hablando con sus NPC o visitando su territorio) para poder negociar o comerciar con ella."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {vasallajes.length > 0 && <VasallajesCard vasallajes={vasallajes} />}
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

/// P286/P297: la deuda de cada vasallaje (Serhu debe a la Concordia) con lo que pasa cada semana.
export function VasallajesCard({ vasallajes }: { vasallajes: VasallajeInfo[] }) {
  return (
    <PanelSection title="Vasallajes del mundo">
      <div className="flex flex-col gap-1.5">
        {vasallajes.map((v) => (
          <div key={v.vasalloSlug} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2 text-xs text-wood-300">
            <p className="font-medium">{v.vasalloNombre} es vasallo de {v.senorNombre}</p>
            {v.rotoEn == null ? (
              <p className="text-2xs text-wood-500">
                Deuda: <span className="font-mono tabular-nums text-accent2-300">{v.deuda}</span> Goirnos · cada semana compra sus armas a crédito ×{v.sobreprecioArmas} (la deuda sube) y cumple una patrulla obligada de {v.patrullaGuerreros} guerreros (baja {v.deudaPorPatrulla})
                {v.proximaRevision != null ? ` · próxima revisión: día ${v.proximaRevision}` : ''}
              </p>
            ) : (
              <p className="text-2xs text-wood-500">Vasallaje roto: {v.motivoRuptura ?? 'sin motivo'}.</p>
            )}
          </div>
        ))}
      </div>
    </PanelSection>
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
  // UX-5 (hito 0.2) — modo consulta: lo que cambia datos se deshabilita con el motivo.
  const consulta = useModoConsulta()
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
          Asigna a un compañero el rol de Diplomático en Súbditos para poder negociar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-2xs text-wood-500">Diplomático: {diplomatico.name}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleAccion('negociar')}
              disabled={busy !== null || !!consulta}
              title={consulta ?? undefined}
              className="tactile flex-1 rounded-lg border border-accent-600/60 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-accent-300 transition-colors hover:bg-accent-500/10 disabled:opacity-50"
            >
              {busy === 'negociar' ? '…' : 'Negociar'}
            </button>
            <button
              type="button"
              onClick={() => handleAccion('sabotear')}
              disabled={busy !== null || !!consulta}
              title={consulta ?? undefined}
              className="tactile flex-1 rounded-lg border border-danger-600/60 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-danger-400 transition-colors hover:bg-danger-500/10 disabled:opacity-50"
            >
              {busy === 'sabotear' ? '…' : 'Sabotear'}
            </button>
            <button
              type="button"
              onClick={() => handleAccion('espiar')}
              disabled={busy !== null || !!consulta}
              title={consulta ?? undefined}
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
              {resultado.accion === 'espiar' && resultado.presion != null && (
                // REI-116 (hito 0.1) — presión con barra y la etapa de la relación, que llegaba sin usarse.
                <div className="mt-1.5 flex flex-col gap-1 text-2xs text-wood-400">
                  <div className="flex items-center justify-between">
                    <span>Presión {resultado.presion} / 100</span>
                    {resultado.stage != null && (
                      <span title="Etapa de la relación: 0 hasta 59 de presión, luego una más cada 10 puntos (máx. 4).">Etapa {resultado.stage} de 4</span>
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-iron-800" role="meter" aria-label="Presión entre facciones" aria-valuemin={0} aria-valuemax={100} aria-valuenow={resultado.presion}>
                    <div className="h-full rounded-full bg-cost-500" style={{ width: `${Math.min(100, Math.max(0, resultado.presion))}%` }} />
                  </div>
                </div>
              )}
              {resultado.accion === 'negociar' && resultado.nivelDiplomatico != null && diplomatico && (
                // REI-116 (hito 0.1, R4) — el diplomático subía de nivel sin que el jugador lo supiera.
                <p className="mt-1 text-2xs text-accent2-300">
                  {resultado.xpGanada ? `+${resultado.xpGanada} XP de diplomacia · ` : ''}
                  {diplomatico.name}: diplomático nivel {resultado.nivelDiplomatico}
                </p>
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
  // UX-5 (hito 0.2) — modo consulta: lo que cambia datos se deshabilita con el motivo.
  const consulta = useModoConsulta()
  const [mercado, setMercado] = useState<{ tratado: boolean; items: MercadoItemInfo[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const { fallo, informar, limpiar } = useErrorConReintento()
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
    } catch (e) {
      informar('No se pudo comprar el objeto.', e, () => void handleComprar(almacenItemId))
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
      <ErrorBanner fallo={fallo} onCerrar={limpiar} />
      {mercado === null ? (
        <Esqueleto filas={3} que="el mercado" />
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
                disabled={busy === item.almacenItemId || goirnos < item.precio || !!consulta}
                title={consulta ?? undefined}
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
                  disabled={busy === item.id || !!consulta}
                  title={consulta ?? undefined}
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
