import { useCallback, useEffect, useState } from 'react'
import type { InventoryItemInfo } from '../../../types'
import { PanelSection } from '../../PanelSection'
import { ErrorBanner } from '../../ErrorBanner'
import { useErrorConReintento } from '../../../hooks/useErrorConReintento'
import { useModoConsulta } from '../../../context/useModoConsulta'
import { getCorrales, postDevolverAlCorral, postEntregarForraje, postLlevarConsigo, postSacrificar, type CorralesInfo } from '../../../lib/api'
import { avisoDeCarencia, ESCALON_LABEL, lineaDeAnimal, resumenDeCorral } from '../../../lib/corrales'

const PASTOS: { slug: string; label: string }[] = [
  { slug: 'pasto-solar', label: 'Pasto Solar' },
  { slug: 'pasto-de-sangre', label: 'Pasto de Sangre' },
]

/// CR-55 (Q10): Reino › Corrales — cada corral con su especie, plazas, animales (etapa y lo que les
/// falta para la siguiente), ganaderos y producción del día; la reserva de forraje y la entrega de
/// pastos. Los ganaderos se asignan como cualquier trabajador de un edificio (Producción).
export function CorralesSection({ saveId, inventory, onRefreshSave }: { saveId: string; inventory: InventoryItemInfo[]; onRefreshSave: () => Promise<void> }) {
  const [datos, setDatos] = useState<CorralesInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const { fallo, informar, limpiar } = useErrorConReintento()
  const consulta = useModoConsulta()

  const cargar = useCallback(async () => {
    try {
      setDatos(await getCorrales(saveId))
    } catch (e) {
      informar('No se pudieron cargar los corrales.', e, () => void cargar())
    }
  }, [saveId, informar])

  useEffect(() => {
    void cargar()
  }, [cargar, inventory])

  async function accion(fn: () => Promise<unknown>, mensaje: string) {
    setBusy(true)
    try {
      await fn()
      await Promise.all([cargar(), onRefreshSave()])
    } catch (e) {
      informar(mensaje, e)
    } finally {
      setBusy(false)
    }
  }

  if (!datos) return <ErrorBanner fallo={fallo} onCerrar={limpiar} />
  const aviso = avisoDeCarencia(datos.diasSinComer, datos.diasSinBeber)
  const pastosQueLlevo = PASTOS.map((p) => ({ ...p, n: inventory.filter((i) => i.catalogSlug === p.slug && !i.slot).length })).filter((p) => p.n > 0)

  return (
    <div className="flex flex-col gap-5">
      <ErrorBanner fallo={fallo} onCerrar={limpiar} />
      <PanelSection title="Forraje">
        <p className="text-xs text-wood-300">
          🌾 <span className="font-mono tabular-nums">{datos.forraje}</span> guardado · cabe <span className="font-mono tabular-nums">{datos.huecoForraje}</span> más
          {datos.forrajeDia > 0 && <> · las Fibrerías dan {datos.forrajeDia} al día</>}
        </p>
        {aviso && <p className="mt-1 text-2xs text-danger-300">{aviso}</p>}
        {pastosQueLlevo.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {pastosQueLlevo.map((p) => (
              <button
                key={p.slug}
                type="button"
                disabled={busy || !!consulta}
                title={consulta ?? undefined}
                onClick={() => void accion(() => postEntregarForraje(saveId, p.slug), 'No se pudo entregar el pasto.')}
                className="tactile rounded-lg border border-accent-600/60 px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-accent-300 hover:bg-accent-500/10 disabled:opacity-50"
              >
                Entregar {p.n} {p.label} (+{p.n * 2})
              </button>
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection title="Corrales">
        {datos.corrales.length === 0 && <p className="text-xs text-wood-500">Aún no tienes corrales del Ganadero. Constrúyelos en Edificios y lleva allí los animales que domestiques.</p>}
        <div className="flex flex-col gap-3">
          {datos.corrales.map((c) => (
            <div key={c.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-wood-100">
                  {c.especieNombre ?? 'Vacío'} <span className="font-sans text-2xs text-wood-500">— {ESCALON_LABEL[c.escalon] ?? `nivel ${c.escalon}`}</span>
                </p>
                <span className="font-mono text-2xs tabular-nums text-wood-400">
                  {c.animales.length}/{c.plazas}
                </span>
              </div>
              {c.animales.length > 0 && <p className="mt-0.5 text-2xs text-wood-400">{resumenDeCorral(c.animales)}</p>}
              {c.guardia && <p className="mt-0.5 text-2xs text-accent-300">🛡️ Guardia: defiende el Reino</p>}
              <p className="mt-0.5 text-2xs text-wood-500">
                {c.ganaderos.length > 0 ? `Ganaderos: ${c.ganaderos.map((g) => g.name).join(', ')}` : 'Sin ganadero: no produce (asígnalo en Producción).'}
              </p>
              {c.produccionDia.length > 0 && (
                <p className="mt-0.5 text-2xs text-emerald-300">Al día: {c.produccionDia.map((p) => `${p.porDia} ${p.nombre}`).join(' · ')}</p>
              )}
              {c.animales.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {c.animales.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-2xs text-wood-300">
                      <span>{lineaDeAnimal(a)}</span>
                      {a.puedeLlevar && (
                        <button
                          type="button"
                          disabled={busy || !!consulta}
                          title={consulta ?? undefined}
                          onClick={() => void accion(() => postLlevarConsigo(saveId, a.id), 'No se pudo llevar contigo.')}
                          className="tactile shrink-0 text-2xs text-accent-300 hover:underline disabled:opacity-50"
                        >
                          Llevar contigo
                        </button>
                      )}
                      {a.etapa !== 'CRIA' && (
                        <button
                          type="button"
                          disabled={busy || !!consulta}
                          title={consulta ?? undefined}
                          onClick={() => void accion(() => postSacrificar(saveId, a.id), 'No se pudo sacrificar.')}
                          className="tactile shrink-0 text-2xs text-wood-500 hover:text-red-300 disabled:opacity-50"
                        >
                          Sacrificar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </PanelSection>

      {(datos.fueraDelCorral?.length ?? 0) > 0 && (
        <PanelSection title="Contigo">
          <ul className="flex flex-col gap-1">
            {datos.fueraDelCorral!.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-xs text-wood-300">
                <span>🐾 {c.name}</span>
                <button
                  type="button"
                  disabled={busy || !!consulta}
                  title={consulta ?? undefined}
                  onClick={() => void accion(() => postDevolverAlCorral(saveId, c.id), 'No se pudo devolver al corral.')}
                  className="tactile shrink-0 text-2xs text-accent-300 hover:underline disabled:opacity-50"
                >
                  Devolver al corral
                </button>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}
    </div>
  )
}
