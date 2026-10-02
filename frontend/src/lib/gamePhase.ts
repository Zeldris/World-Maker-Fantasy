// Estado único de la partida (UX-1 y UX-2, hito 0.2 — roadmap-front-ux.md § 4.1 y § 5).
//
// `calcularFase` reduce las banderas sueltas de GameView a una sola fase, con prioridad fija si
// coinciden; `canDo` es la matriz de permisos de § 5 como datos. Todo lo que decide "¿se puede
// ahora?" (composer, botones que lanzan un turno, tarjetas del registro, brújula, paneles) pregunta
// aquí, así el motivo es el mismo venga de donde venga.

export type FaseJuego = 'libre' | 'pensando' | 'ocupado' | 'encuentro' | 'combate' | 'dinamico' | 'eleccion' | 'muerte' | 'fin'

export interface EstadoParaFase {
  /// La partida ha terminado (`endedAt`).
  terminada: boolean
  /// Muerte del personaje sin resolver (`pendingDeathResolution`).
  muertePendiente: boolean
  /// Combate empezado (`combateIniciado`), tenga o no el modal abierto.
  enCombate: boolean
  /// Modo dinámico en marcha (`activeDynamicMode`).
  modoDinamico: boolean
  /// El narrador está escribiendo la respuesta a un turno (`characterThinking`).
  narradorEscribiendo: boolean
  /// Elección obligatoria a la vista: clase, especialización o fundación del reino.
  eleccionAbierta: boolean
  /// Un agresivo corta el paso y espera reacción (`dynamicModeOffer.combateForzado`).
  encuentroPendiente: boolean
  /// Actividad con duración en curso (`busyUntil`).
  ocupado: boolean
}

/// Prioridad, de mayor a menor: lo que acaba o interrumpe la partida manda sobre lo demás. El
/// narrador escribiendo va por encima de combate y modo dinámico porque, mientras escribe, ningún
/// composer (tampoco el de combate) acepta otra acción.
export function calcularFase(e: EstadoParaFase): FaseJuego {
  if (e.terminada) return 'fin'
  if (e.muertePendiente) return 'muerte'
  if (e.narradorEscribiendo) return 'pensando'
  if (e.enCombate) return 'combate'
  if (e.modoDinamico) return 'dinamico'
  if (e.eleccionAbierta) return 'eleccion'
  if (e.encuentroPendiente) return 'encuentro'
  if (e.ocupado) return 'ocupado'
  return 'libre'
}

export type AccionJuego =
  /// Composer, barra de habilidades y botones que lanzan un turno (Construir, Viajar, Campamento…).
  | 'enviarTurno'
  /// Acciones de las tarjetas del registro (ofertas, sugerencias).
  | 'tarjeta'
  | 'abrirPanel'
  /// Botones de los paneles que cambian datos (equipar, tirar, mercado…).
  | 'modificarPanel'
  /// Brújula y mapa de zona.
  | 'moverse'
  /// Abrir una decisión (clase, especialización, reino).
  | 'decidir'
  | 'salir'

export interface Permiso {
  permitido: boolean
  /// Por qué no (o el aviso, si está permitido con aviso). Null si no hay nada que decir.
  motivo: string | null
}

const MOTIVO_FASE: Record<Exclude<FaseJuego, 'libre'>, string> = {
  pensando: 'El narrador todavía está escribiendo.',
  ocupado: 'Estás ocupado con otra actividad.',
  encuentro: 'Primero reacciona a quien te corta el paso.',
  combate: 'Estás en combate.',
  dinamico: 'Estás en mitad de una escena.',
  eleccion: 'Primero termina la elección pendiente.',
  muerte: 'Primero resuelve lo que ha pasado tras tu muerte.',
  fin: 'La partida ha terminado.',
}

const SI: Permiso = { permitido: true, motivo: null }
const no = (fase: FaseJuego): Permiso => ({ permitido: false, motivo: fase === 'libre' ? null : MOTIVO_FASE[fase] })

/// Matriz de § 5. Desviaciones a propósito, apuntadas en el roadmap:
/// - `encuentro` deja escribir y usar tarjetas: el backend acepta el turno (solo rechaza moverse) y
///   hablar con quien te corta el paso es una reacción válida; la tarjeta del encuentro es la forma
///   de combatir o huir.
/// - `combate` bloquea el composer principal: la acción de combate se escribe en su propio modal.
export function canDo(fase: FaseJuego, accion: AccionJuego): Permiso {
  switch (accion) {
    case 'enviarTurno':
    case 'tarjeta':
      return fase === 'libre' || fase === 'encuentro' ? SI : no(fase)
    case 'abrirPanel':
      return fase === 'dinamico' ? no(fase) : SI
    case 'modificarPanel':
      return fase === 'libre' || fase === 'encuentro' ? SI : no(fase)
    case 'moverse':
      return fase === 'libre' ? SI : no(fase)
    case 'decidir':
      if (fase === 'libre' || fase === 'eleccion' || fase === 'encuentro' || fase === 'ocupado') return SI
      if (fase === 'fin') return no(fase)
      return { permitido: false, motivo: `${MOTIVO_FASE[fase]} La elección se abrirá al terminar.` }
    case 'salir':
      if (fase === 'pensando') return { permitido: true, motivo: 'El narrador está escribiendo: lo que cuente se guardará igualmente.' }
      if (fase === 'combate') return { permitido: true, motivo: 'Estás en combate: al volver seguirá donde lo dejaste.' }
      return SI
  }
}
