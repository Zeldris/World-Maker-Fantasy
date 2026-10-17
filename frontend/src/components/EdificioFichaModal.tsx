import { useEffect, useState } from 'react'
import { getFichaEdificio, type FichaEdificio, type ZonePointInfo } from '../lib/api'
import { SelectionModalShell, confirmButtonClasses } from './SelectionModalShell'
import { disposicionDe } from '../lib/zonaFichas'

const chip = 'rounded-full border border-iron-700 bg-wood-950/50 px-2.5 py-1 uppercase tracking-wide text-wood-400'

/// P178 (QA-27, decidido por la usuaria 2026-10-17): la ficha de un edificio del mapa. Antes «Ver ficha
/// completa» solo daba el nombre y la distancia. Cabecera con su bando y cómo te ve (como la ficha de
/// estación de X4), su estado, quién lo lleva y qué ofrece; «Comerciar» llega con el comercio en persona.
export function EdificioFichaModal({
  saveId,
  point,
  onClose,
  onInteractuar,
  onIrHasta,
}: {
  saveId: string
  point: ZonePointInfo
  onClose: () => void
  /// Junto al edificio: abre el menú de quien lo lleva.
  onInteractuar?: () => void
  /// Lejos: camina hasta él.
  onIrHasta?: () => void
}) {
  const [ficha, setFicha] = useState<FichaEdificio | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    getFichaEdificio(saveId, point.id)
      .then((f) => vivo && setFicha(f))
      .catch(() => vivo && setError('No se pudo cargar la ficha del edificio.'))
    return () => {
      vivo = false
    }
  }, [saveId, point.id])

  return (
    <SelectionModalShell
      title={ficha?.nombre ?? point.nombre}
      onCancel={onClose}
      cancelLabel="Cerrar"
      footer={
        <>
          {onInteractuar && (
            <button type="button" onClick={() => { onInteractuar(); onClose() }} className={confirmButtonClasses('accent')}>
              Interactuar
            </button>
          )}
          {!onInteractuar && onIrHasta && (
            <button type="button" onClick={() => { onIrHasta(); onClose() }} className={confirmButtonClasses('accent')}>
              Ir hasta aquí
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5 text-2xs">
        <span className={chip}>Edificio{ficha?.nivel ? ` · nivel ${ficha.nivel}` : ''}</span>
        <span className={chip}>{disposicionDe(point)}</span>
        {ficha && <span className={chip}>{ficha.estado}</span>}
      </div>
      {error && <p className="text-xs text-danger-400">{error}</p>}
      {!ficha && !error && <p className="text-xs italic text-wood-500">Cargando…</p>}
      {ficha && (
        <div className="space-y-3 text-sm text-wood-200">
          {ficha.descripcion && <p className="text-xs text-wood-400">{ficha.descripcion}</p>}
          {ficha.detallesEstado.length > 0 && <p className="text-xs text-wood-400">{ficha.detallesEstado.join(' · ')}</p>}
          <section>
            <h4 className="text-2xs uppercase tracking-wide text-wood-500">Quién lo lleva</h4>
            {ficha.encargado ? (
              <p>
                {ficha.encargado.nombre}
                <span className="text-xs text-wood-500"> · {ficha.encargado.aqui ? 'está aquí' : 'no está ahora'}</span>
              </p>
            ) : (
              <p className="text-xs italic text-wood-500">Nadie se ocupa de él.</p>
            )}
          </section>
          {ficha.ofrece.length > 0 && (
            <section>
              <h4 className="text-2xs uppercase tracking-wide text-wood-500">Qué ofrece</h4>
              <ul className="space-y-0.5">
                {ficha.ofrece.map((o) => (
                  <li key={o.label} className={o.disponible ? '' : 'text-wood-500'}>
                    {o.label}
                    {o.motivo && <span className="text-xs"> · {o.motivo}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </SelectionModalShell>
  )
}
