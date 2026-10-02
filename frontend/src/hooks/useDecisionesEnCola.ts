import { useEffect, useState } from 'react'

/// Tiempo de lectura de la última narración antes de abrir una decisión: ~40 ms por carácter,
/// entre 2 y 12 segundos.
export function msDeLectura(texto: string): number {
  return Math.min(12_000, Math.max(2_000, texto.length * 40))
}

/// UX-10 (hito 0.2, roadmap-front-ux.md § 4.3, H8 y H9) — clase, especialización y fundar reino
/// **esperan** a que acabe el combate, la escena o la narración en curso, y a que dé tiempo a leer
/// lo último que se narró. Mientras esperan, la cabecera avisa y deja abrirlas antes (`abrirYa`).
export function useDecisionesEnCola({
  hayDecision,
  bloqueada,
  ultimaNarracion,
}: {
  hayDecision: boolean
  /// Combate, modo dinámico o narrador escribiendo.
  bloqueada: boolean
  ultimaNarracion: string
}): { mostrar: boolean; enEspera: boolean; abrirYa: () => void } {
  const [lista, setLista] = useState(false)
  const [forzada, setForzada] = useState(false)

  useEffect(() => {
    if (!hayDecision || bloqueada) {
      setLista(false)
      if (!hayDecision) setForzada(false)
      return
    }
    const t = setTimeout(() => setLista(true), msDeLectura(ultimaNarracion))
    return () => clearTimeout(t)
  }, [hayDecision, bloqueada, ultimaNarracion])

  const mostrar = hayDecision && (forzada || (lista && !bloqueada))
  return { mostrar, enEspera: hayDecision && !mostrar, abrirYa: () => setForzada(true) }
}
