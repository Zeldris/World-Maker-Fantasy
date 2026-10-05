import { useCallback, useEffect, useState } from 'react'
import { deleteOrdenComercio, getComercio, postOrdenComercio, type ComercioInfo } from '../../../lib/api'
import { PanelSection } from '../../PanelSection'
import { PanelEmptyState } from '../../PanelEmptyState'
import { Esqueleto } from '../../Esqueleto'

// CR-47 (47d, hito 0.2): el Mercado del Reino. Órdenes permanentes («compra hierro si baja de 20»,
// «vende madera si pasa de 80», como el Mercado de Bellwright) que cumplen las caravanas con las
// facciones con tratado o alianza; el precio va unidad a unidad (como X4).

const ESTADO: Record<ComercioInfo['caravanas'][number]['status'], string> = {
  EN_CAMINO: 'en camino',
  VOLVIENDO: 'volviendo',
  TERMINADA: 'de vuelta',
  ASALTADA: 'asaltada',
}

export function ComercioSection({ saveId }: { saveId: string }) {
  const [datos, setDatos] = useState<ComercioInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [catalogSlug, setCatalogSlug] = useState('')
  const [tipo, setTipo] = useState<'COMPRA' | 'VENTA'>('COMPRA')
  const [umbral, setUmbral] = useState(20)
  const [lote, setLote] = useState(5)
  const [socio, setSocio] = useState('')

  const cargar = useCallback(() => {
    getComercio(saveId)
      .then((d) => {
        setDatos(d)
        setCatalogSlug((prev) => prev || d.objetos[0]?.slug || '')
      })
      .catch(() => setError('No se pudo leer el Mercado.'))
  }, [saveId])
  useEffect(cargar, [cargar])

  if (!datos) return error ? <p className="text-xs text-danger-400">{error}</p> : <Esqueleto filas={3} que="el Mercado" />
  if (!datos.mercado) {
    return (
      <PanelEmptyState
        icon="⚖️"
        title="Sin Mercado"
        hint={datos.reino ? 'Construye un Mercado en el Reino para dejar órdenes de compra y venta que cumplan tus caravanas.' : 'Funda tu Reino y construye un Mercado para comerciar en volumen.'}
      />
    )
  }

  const crear = () => {
    setError(null)
    postOrdenComercio(saveId, { catalogSlug, tipo, umbral, lote, factionSlug: socio || null })
      .then(cargar)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudo dejar la orden.'))
  }
  const borrar = (id: string) => {
    deleteOrdenComercio(saveId, id).then(cargar).catch(() => setError('No se pudo quitar la orden.'))
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelSection title="Mercado — órdenes permanentes">
        {datos.socios.length === 0 && (
          <p className="mb-2 text-xs italic text-wood-400">Sin tratado ni alianza con nadie, ninguna caravana tiene adónde ir.</p>
        )}
        <form
          aria-label="Nueva orden"
          className="flex flex-wrap items-end gap-2 text-xs"
          onSubmit={(e) => {
            e.preventDefault()
            crear()
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-wood-400">Qué</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as 'COMPRA' | 'VENTA')} className="rounded border border-iron-700 bg-wood-950/60 px-2 py-1">
              <option value="COMPRA">Comprar si baja de</option>
              <option value="VENTA">Vender si pasa de</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-wood-400">Umbral</span>
            <input type="number" min={0} value={umbral} onChange={(e) => setUmbral(Number(e.target.value))} className="w-16 rounded border border-iron-700 bg-wood-950/60 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-wood-400">Objeto</span>
            <select value={catalogSlug} onChange={(e) => setCatalogSlug(e.target.value)} className="max-w-48 rounded border border-iron-700 bg-wood-950/60 px-2 py-1">
              {datos.objetos.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-wood-400">Por viaje</span>
            <input type="number" min={1} max={50} value={lote} onChange={(e) => setLote(Number(e.target.value))} className="w-16 rounded border border-iron-700 bg-wood-950/60 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-wood-400">Con</span>
            <select value={socio} onChange={(e) => setSocio(e.target.value)} className="rounded border border-iron-700 bg-wood-950/60 px-2 py-1">
              <option value="">quien tenga</option>
              {datos.socios.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded border border-accent-600/60 bg-accent-500/10 px-3 py-1 text-accent-100 hover:bg-accent-500/20">
            Dejar orden
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-danger-400">{error}</p>}
        <ul aria-label="Órdenes" className="mt-3 flex flex-col gap-1.5">
          {datos.ordenes.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 rounded border border-iron-800 bg-wood-950/40 px-2.5 py-1.5 text-xs text-wood-200">
              <span>
                {o.tipo === 'COMPRA' ? `Comprar ${o.nombre} si baja de ${o.umbral}` : `Vender ${o.nombre} si pasa de ${o.umbral}`} · {o.lote} por viaje
                {o.factionSlug ? ` · con ${datos.socios.find((s) => s.slug === o.factionSlug)?.name ?? o.factionSlug}` : ''}
              </span>
              <button type="button" onClick={() => borrar(o.id)} aria-label={`Quitar la orden de ${o.nombre}`} className="text-wood-500 hover:text-danger-300">
                ✕
              </button>
            </li>
          ))}
          {datos.ordenes.length === 0 && <li className="text-xs italic text-wood-500">Sin órdenes todavía.</li>}
        </ul>
      </PanelSection>
      {datos.caravanas.length > 0 && (
        <PanelSection title="Caravanas">
          <ul aria-label="Caravanas" className="flex flex-col gap-1 text-xs text-wood-300">
            {datos.caravanas.map((c) => (
              <li key={c.id}>
                ⚑ {c.tipo === 'COMPRA' ? 'Compra' : 'Venta'} de {c.nombre} con {c.faccion} — {ESTADO[c.status]}
                {c.status === 'EN_CAMINO' || c.status === 'VOLVIENDO' ? ` (vuelve el día ${c.diaRegreso + 1})` : ''}
              </li>
            ))}
          </ul>
        </PanelSection>
      )}
    </div>
  )
}
