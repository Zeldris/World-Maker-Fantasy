import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { EnciclopediaPanel } from '../components/panels/EnciclopediaPanel'
import { DetailModal, type DetailTarget } from '../components/DetailModal'
import { useEnciclopedia } from '../hooks/useEnciclopedia'
import { worlds } from '../data/mock'
import { HerramientasAdminContext, fijarModoDesarrollador, useModoDesarrollador } from '../lib/modoDesarrollador'

// Vista de administrador (petición explícita de Álvaro, 2026-09-21: "para que yo pueda generar
// todos los prompts de imágenes de forma cómoda... la enciclopedia completa con todo descubierto,
// es solo para mí como admin, esto no lo llevamos al instalador"). Sin ruta visible desde ningún
// flujo de jugador — solo enlazada desde un texto discreto en Home.tsx. Nunca pasa `saveId`: el
// propio backend (`world.ts`, `isDiscovered`/`discoveryFaseFor`) ya trata la ausencia de `saveId`
// como "todo DESCUBIERTO" — mismo comportamiento que la Enciclopedia fuera de partida, cero
// backend nuevo. Reutiliza `EnciclopediaPanel` tal cual (mismas categorías/búsqueda/fichas), solo
// cambia de dónde saca los datos y qué pasa como `onInsert` (aquí no hay composer al que insertar).
export function AdminEnciclopedia() {
  const navigate = useNavigate()
  const worldSlug = worlds[0]?.id ?? null
  const { raw, loading } = useEnciclopedia(worldSlug, null)
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null)
  const modoDesarrollador = useModoDesarrollador()

  return (
    <HerramientasAdminContext.Provider value={true}>
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <button type="button" onClick={() => navigate('/')} className="mb-1 text-xs text-wood-500 transition-colors hover:text-accent-300">
            ← Volver
          </button>
          <h1 className="font-serif text-2xl text-wood-100">Enciclopedia completa (admin)</h1>
          <p className="text-sm text-wood-400">
            Todo desbloqueado, sin depender de ninguna partida — solo para generar prompts de imagen. No visible para
            jugadores.
          </p>
        </div>
        {/* CFG-33 (hito 0.1) — las herramientas de prompts también dentro de la partida. */}
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-wood-400">
          <input type="checkbox" checked={modoDesarrollador} onChange={(e) => fijarModoDesarrollador(e.target.checked)} />
          Modo desarrollador en partida
        </label>
      </div>

      <div className="flex min-h-0 flex-1">
        <EnciclopediaPanel
          data={raw}
          loading={loading}
          recipesStatus={[]}
          onInsert={() => {}}
          onDetail={(target) => setDetailTarget(target)}
        />
      </div>

      {detailTarget && <DetailModal target={detailTarget} onClose={() => setDetailTarget(null)} worldSlug={worldSlug} />}
    </div>
    </HerramientasAdminContext.Provider>
  )
}
