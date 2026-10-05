import { useState } from 'react'
import { ModalShell } from './ModalShell'
import { diaDeFiccion } from '../lib/noticias'
import type { AvisoMisionInfo } from '../lib/api'

// CR-40 (40g, hito 0.2) — avisos de misión secundaria: los de un tablón de avisos o la misión
// personal que propone un NPC con nombre. Cada uno con su recompensa por tabla y Aceptar; los
// límites (3 activas, una por facción) los aplica el backend y su motivo sale aquí como error.

export interface AvisosModalProps {
  titulo: string
  subtitulo?: string
  avisos: AvisoMisionInfo[]
  /// Texto cuando no hay ninguno (tablón vacío, el NPC no tiene trabajo).
  vacio: string
  cargando?: boolean
  onAceptar: (avisoId: string) => Promise<void>
  onClose: () => void
}

function Aviso({ aviso, onAceptar }: { aviso: AvisoMisionInfo; onAceptar: (id: string) => Promise<void> }) {
  const [estado, setEstado] = useState<'libre' | 'enviando' | 'aceptado'>('libre')
  const [error, setError] = useState<string | null>(null)
  const aceptar = async () => {
    setEstado('enviando')
    setError(null)
    try {
      await onAceptar(aviso.id)
      setEstado('aceptado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aceptar')
      setEstado('libre')
    }
  }
  const r = aviso.recompensa
  return (
    <li className="rounded-lg border border-iron-700 bg-wood-950/40 px-3.5 py-2.5">
      <p className="font-medium text-wood-100">{aviso.titulo}</p>
      {aviso.faccion && <p className="text-2xs uppercase tracking-wide text-wood-500">{aviso.faccion}</p>}
      <p className="mt-1 text-xs leading-relaxed text-wood-300">{aviso.descripcion}</p>
      <p className="mt-1.5 text-xs text-accent-300">
        <span className="text-2xs font-semibold uppercase tracking-wide text-wood-500">Recompensa: </span>
        +{r.xp} XP · {r.goirnos} Goirnos · reputación +{r.reputacion}
        {r.reputacionConEnemiga < 0 && <span className="text-red-300"> (y {r.reputacionConEnemiga} con la facción contraria)</span>}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {estado === 'aceptado' ? (
          <span className="text-xs text-accent2-300">Aceptada: la tienes en el panel de Misiones.</span>
        ) : (
          <button type="button" disabled={estado === 'enviando'} onClick={aceptar} className="rounded border border-accent-600/60 bg-accent-500/15 px-2.5 py-1 text-xs text-accent-100 hover:bg-accent-500/25 disabled:opacity-50">
            Aceptar
          </button>
        )}
        {aviso.retiraEn !== undefined && estado !== 'aceptado' && <span className="text-2xs text-wood-500">Se retira el día {diaDeFiccion(aviso.retiraEn)}</span>}
        {error && <span className="text-2xs text-red-300">{error}</span>}
      </div>
    </li>
  )
}

export function AvisosModal({ titulo, subtitulo, avisos, vacio, cargando = false, onAceptar, onClose }: AvisosModalProps) {
  return (
    <ModalShell title={titulo} subtitle={subtitulo} icon="📜" onClose={onClose}>
      {cargando ? (
        <p className="text-sm text-wood-400">Leyendo los avisos…</p>
      ) : avisos.length === 0 ? (
        <p className="text-sm text-wood-400">{vacio}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {avisos.map((a) => (
            <Aviso key={a.id} aviso={a} onAceptar={onAceptar} />
          ))}
        </ul>
      )}
    </ModalShell>
  )
}
