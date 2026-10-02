import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getLibroDeSucesos, type FamiliaSuceso, type SucesoLibro } from '../lib/api'

// Libro de Sucesos, vista de administración (CR-4, hito 0.2 — roadmap-cronista.md § 15). Solo
// lectura y solo para revisar a mano qué registra el motor: sin enlace en ningún flujo de jugador
// (mismo criterio que /admin/enciclopedia), se abre con la ruta /admin/partida/:id/libro.
const FAMILIAS: { id: FamiliaSuceso; label: string }[] = [
  { id: 'JUGADOR', label: 'Jugador' },
  { id: 'VIDA_MUERTE', label: 'Vida y muerte' },
  { id: 'DIPLOMACIA', label: 'Diplomacia' },
  { id: 'FACCION', label: 'Facción' },
  { id: 'REINO', label: 'Reino' },
  { id: 'CLIMA', label: 'Clima' },
  { id: 'NATURAL', label: 'Natural' },
  { id: 'ECONOMIA', label: 'Economía' },
  { id: 'LORE', label: 'Lore' },
  { id: 'SISTEMA', label: 'Sistema' },
]
const ORIGEN_LABEL: Record<SucesoLibro['origen'], string> = { JUGADOR: 'jugador', MUNDO: 'mundo', MOTOR: 'motor', IA_PROPUESTA: 'IA' }

export function AdminLibro() {
  const navigate = useNavigate()
  const { id: saveId } = useParams()
  const [familia, setFamilia] = useState<FamiliaSuceso | null>(null)
  const [importanciaMin, setImportanciaMin] = useState(1)
  const [sucesos, setSucesos] = useState<SucesoLibro[]>([])
  const [personaje, setPersonaje] = useState('')
  const [total, setTotal] = useState(0)
  const [hayMas, setHayMas] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(
    async (antesDe?: string) => {
      if (!saveId) return
      setCargando(true)
      setError(null)
      try {
        const libro = await getLibroDeSucesos(saveId, { familia, importanciaMin, antesDe })
        setPersonaje(libro.personaje)
        setTotal(libro.total)
        setHayMas(libro.hayMas)
        setSucesos((prev) => (antesDe ? [...prev, ...libro.sucesos] : libro.sucesos))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el Libro.')
      } finally {
        setCargando(false)
      }
    },
    [saveId, familia, importanciaMin],
  )

  useEffect(() => {
    void cargar()
  }, [cargar])

  const textoDe = (id: string) => sucesos.find((s) => s.id === id)?.texto ?? id

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-8">
      <div>
        <button type="button" onClick={() => navigate(-1)} className="mb-1 text-xs text-wood-500 transition-colors hover:text-accent-300">
          ← Volver
        </button>
        <h1 className="font-serif text-2xl text-wood-100">Libro de Sucesos (admin)</h1>
        <p className="text-sm text-wood-400">
          {personaje ? `${personaje} · ` : ''}
          {total} sucesos en total. Solo lectura, para revisar lo que registra el motor; no visible para jugadores.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
        <button
          type="button"
          onClick={() => setFamilia(null)}
          aria-pressed={familia === null}
          className={`rounded-full border px-3 py-1 text-xs ${familia === null ? 'border-accent-500 text-accent-300' : 'border-iron-700 text-wood-400 hover:text-wood-200'}`}
        >
          Todas
        </button>
        {FAMILIAS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFamilia(f.id)}
            aria-pressed={familia === f.id}
            className={`rounded-full border px-3 py-1 text-xs ${familia === f.id ? 'border-accent-500 text-accent-300' : 'border-iron-700 text-wood-400 hover:text-wood-200'}`}
          >
            {f.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-wood-400">
          Importancia mínima
          <select
            value={importanciaMin}
            onChange={(e) => setImportanciaMin(Number(e.target.value))}
            className="rounded border border-iron-700 bg-wood-950 px-2 py-1 text-wood-100"
          >
            {[1, 3, 5, 7, 9].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-danger-400">{error}</p>}

      <ol className="flex flex-col gap-2">
        {sucesos.map((s) => (
          <li key={s.id} className="rounded-lg border border-iron-700 bg-wood-950/40 px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xs uppercase tracking-wide text-wood-500">
              <span>{s.fecha}</span>
              <span className="font-mono">{s.tipo}</span>
              <span>{ORIGEN_LABEL[s.origen]}</span>
              <span className={`ml-auto font-semibold ${s.importancia >= 7 ? 'text-danger-400' : s.importancia >= 5 ? 'text-accent-300' : 'text-wood-400'}`}>
                importancia {s.importancia}
              </span>
            </div>
            <p className="mt-1 text-sm text-wood-100">{s.textoNarrado ?? s.texto}</p>
            {s.actores.length > 0 && (
              <p className="mt-1 text-2xs text-wood-500">
                {s.actores.map((a) => `${a.papel.toLowerCase()}: ${a.entidadTipo.toLowerCase()} ${a.entidadId}`).join(' · ')}
              </p>
            )}
            {s.causaIds.length > 0 && <p className="mt-1 text-2xs text-wood-400">Por: {s.causaIds.map(textoDe).join(' · ')}</p>}
            {s.efectoIds.length > 0 && <p className="mt-1 text-2xs text-wood-400">Llevó a: {s.efectoIds.map(textoDe).join(' · ')}</p>}
          </li>
        ))}
      </ol>

      {!cargando && sucesos.length === 0 && !error && <p className="text-sm text-wood-500">Nada que mostrar con estos filtros.</p>}
      {hayMas && (
        <button
          type="button"
          disabled={cargando}
          onClick={() => void cargar(sucesos[sucesos.length - 1]?.id)}
          className="self-center rounded-lg border border-iron-700 px-4 py-2 text-sm text-wood-200 hover:border-accent-600/60 disabled:opacity-50"
        >
          {cargando ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
    </div>
  )
}
