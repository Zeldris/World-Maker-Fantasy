import { useEffect, useRef, useState } from 'react'

/// Frases ambientales para llenar la espera real de generación (30s-2min en este hardware,
/// ver docs/07-mundo-helek-sirik.md). No aceleran nada, solo hacen que la espera se sienta
/// menos vacía — puramente decorativas, sin relación con lo que realmente vaya a pasar.
export const characterWaitingFlavor: string[] = [
  'Gorhorn respira hondo; el aire seco de las Llanuras le raspa la garganta.',
  'El viento del desierto levanta polvo rojizo a su alrededor.',
  'A lo lejos, un volcán exhala una columna fina de humo.',
  'El brillo perlado del cielo nocturno se refleja en la arena.',
  'Gorhorn ajusta el tótem atado a su espalda sin pensarlo, por costumbre.',
  'Un silencio pesado se extiende por la estepa infinita.',
  'Algo se mueve entre las dunas, demasiado lejos para distinguirlo.',
  'El sudor le pega la piel al arnés de cuero.',
  'Un Corretolva cruza corriendo entre la hierba rojiza, más asustado que peligroso.',
  'El filo mellado del hacha rota pesa en su mano, familiar como una segunda piel.',
  'Un zumbido lejano — quizás solo el viento entre las rocas, quizás no.',
  'Gorhorn pasa un pulgar sobre la cicatriz del colmillo perdido, sin darse cuenta.',
  'El olor a Salvia del Polvo flota cerca, amargo y conocido.',
  'Una Espina del Viento se entierra bajo la arena a unos pasos, invisible.',
  'El horizonte tiembla con el calor, borrando la línea entre tierra y cielo.',
]

/// Frases de espera EN COMBATE (2026-07-29, "los mensajes que salen mientras narra el combate,
/// deben ser relacionados con combates") — `characterWaitingFlavor` de arriba es ambiente de
/// exploración (viento, dunas...), fuera de lugar mientras se resuelve un intercambio de golpes.
/// Mismo criterio: puramente decorativas, sin relación con el resultado real del turno.
export const combatWaitingFlavor: string[] = [
  'Gorhorn aprieta el mango del hacha, atento al siguiente movimiento.',
  'El polvo levantado por el último golpe todavía no se ha asentado.',
  'Un jadeo entrecortado, suyo o del enemigo, corta el silencio tenso.',
  'Los músculos en tensión, a la espera de saber quién golpea primero.',
  'El filo mellado refleja un instante de luz antes del siguiente choque.',
  'El corazón le late con fuerza contra las costillas.',
  'Un paso en falso en la arena podría costarle caro ahora mismo.',
  'El enemigo cambia el peso de un pie a otro, calculando.',
]

export const worldWaitingFlavor: string[] = [
  'El mundo sigue su curso, ajeno a este instante.',
  'En algún punto de Berig, la guerra no se detiene.',
  'Las tormentas de arena magnética se gestan lejos, en el horizonte.',
  'La niebla del Estrecho sigue cubriendo el mar entre continentes.',
  'Otros clanes, otras vidas, avanzan sin saber de esta historia.',
  'En el Campamento Serhu, alguien aviva un fuego que Gorhorn no ve.',
  'Una Gargantúa de Ceniza migra despacio, indiferente a las fronteras de los orcos.',
  'La Concordia de Hierro sigue moviendo patrullas por caminos que no son estos.',
  'En algún taller de la Cicatriz de Cristal, una casa Kelife trama su siguiente jugada.',
  'El muro de obsidiana del norte sigue en pie, guardando lo que nadie ha visto todavía.',
]

/// Rota entre las frases mientras `active` es true; se detiene y limpia al desactivarse.
export function useRotatingFlavor(active: boolean, pool: string[], intervalMs = 4000): string {
  const [index, setIndex] = useState(0)
  const poolRef = useRef(pool)
  poolRef.current = pool

  useEffect(() => {
    if (!active) return
    setIndex(Math.floor(Math.random() * poolRef.current.length))
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % poolRef.current.length)
    }, intervalMs)
    return () => clearInterval(interval)
  }, [active, intervalMs])

  return pool[index] ?? pool[0]
}
