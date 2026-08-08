import { useMemo, useState } from 'react'
import { CONDICION_LABEL } from '../lib/health'
import { attributeLabels, attributeColorClasses } from '../lib/dice'
import { resolveImageUrl, type EnciclopediaResponse } from '../lib/api'
import { resolveCombatAbilities, type ResolvedAbility } from '../lib/npcAbilities'
import { faunaFloraToDetailTarget } from '../lib/enciclopediaTargets'
import { useEnciclopediaLink } from '../context/useEnciclopediaLink'
import { HealthBar } from './HealthBar'
import { EnergyBar } from './EnergyBar'
import { MediaSlot } from './ImagePromptDisplay'
import { TooltipAnchor } from './TooltipAnchor'
import { CombatSelectionModal } from './CombatSelectionModal'
import type { CombatNpcDisplay } from './CombatComposer'
import type { CondicionFisica, InventoryItemInfo, SavedActionInfo } from '../types'

interface CombatPanelProps {
  /// Nombre del personaje (2026-07-29, "nunca queda claro el estado del enemigo... quiero saber
  /// cómo estamos ambos") — para la barra de estado persistente de abajo.
  playerName: string
  playerCondicion: CondicionFisica
  /// Sistema de fatiga (2026-07-29) — para la barra de energía junto a la de salud y para
  /// deshabilitar/marcar el coste de las habilidades que no alcanzan.
  energia: number
  energiaMax: number
  npcs: CombatNpcDisplay[]
  selectedNpcSlug: string | null
  onSelectNpc: (slug: string) => void
  combatAbilities: SavedActionInfo[]
  selectedAbilityId: string | null
  onSelectAbility: (id: string | null) => void
  combatItems: InventoryItemInfo[]
  selectedItemId: string | null
  onSelectItem: (id: string | null) => void
  busy: boolean
  ended: boolean
  /// Rediseño del turno de combate (2026-07-28) — true cuando el NPC ganó la iniciativa del
  /// intercambio y el jugador debe elegir su defensa a ciegas: oculta objetivos/Huir/objetos y
  /// cambia la etiqueta del botón de acción.
  awaitingDefense: boolean
  /// Rediseño del turno de combate (2026-07-29, "quiero que sea más claro cuando es turno de
  /// ataque... indicándome qué salió en los dados para saber por qué ataco primero") — tirada real
  /// de iniciativa del último turno resuelto; null si se forzó sin dados o aún no hay ninguna.
  lastInitiativeRoll: { ganador: 'jugador' | 'npc'; jugadorTirada: number; npcTirada: number } | null
  onActuar: () => void
  onRegistrar: (npc: CombatNpcDisplay) => void
  /// Botón "Decapitar" (petición explícita, 2026-07-30, ajustado tras probarlo en vivo: "de los
  /// enemigos incapacitados tienes que marcar todos aquellos que quieras decapitar... un popup
  /// donde marcando con checkbox puedas elegir a quien decapitar y confirmarlo o cancelarlo") —
  /// se llama con la lista YA confirmada desde el modal de selección (ver más abajo), nunca por
  /// NPC suelto. Golpe de gracia determinista, solo sobre los que siguen INCAPACITADO.
  onDecapitarSeleccion: (npcs: CombatNpcDisplay[]) => void
  onHuir: () => void
  onContinue: () => void
  /// Resumen de combate (petición explícita, 2026-07-30, ajustado tras probarlo en vivo: "si le
  /// doy a saquear me tiene que aparecer todos los objetos a saquear y que pueda marcar los que
  /// me quiero quedar") — se llama con los NOMBRES ya confirmados desde el modal de selección
  /// (ver más abajo); el backend solo copia esos objetos concretos, no el loadout entero.
  /// `fullyLootedSlugs` (2026-07-31, saqueo parcial: "si no saqueas todo el botón sigue") — los
  /// NPC de los que se marcaron TODOS sus objetos conocidos, no solo alguno — el caller solo
  /// puede marcarlos `yaSaqueado` a ellos, dejando el resto disponible para una visita posterior.
  onSaquearSeleccion: (itemNames: string[], fullyLootedSlugs: string[], itemNamesByNpc: Record<string, string[]>) => void
  onAbilityDetail: (ability: SavedActionInfo) => void
  onItemDetail: (item: InventoryItemInfo) => void
  enciclopedia: EnciclopediaResponse | null
}

/// Chip de habilidad de solo lectura (las del enemigo) — tooltip estilizado con la descripción
/// (rediseño de la vista de combate, 2026-07-28, petición explícita: "no falta un hover que
/// muestre la descripción") + icono "ⓘ" para abrir su ficha completa en la Enciclopedia, si tiene
/// una página real a la que enlazar (`detailTarget`, ver npcAbilities.ts).
///
/// Rediseño (petición explícita, 2026-07-30, tras verlo en vivo: "se ve fatal... queda muy
/// cargada de color") — un punto de color por atributo en vez de teñir el borde Y el texto
/// enteros: mismo dato de un vistazo (mismo color que el árbol de debilidades de la Enciclopedia),
/// sin el efecto "confeti" de varios chips con 7 colores posibles a la vez.
function AbilityChip({ ability, onDetail }: { ability: ResolvedAbility; onDetail: (target: NonNullable<ResolvedAbility['detailTarget']>) => void }) {
  const colors = attributeColorClasses[ability.preferredAttribute]
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-iron-700 bg-wood-950/40 px-2 py-1 text-2xs text-wood-300">
      <TooltipAnchor text={ability.description} className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} aria-hidden="true" />
        <span aria-hidden="true">{ability.icon}</span> <span>{ability.name}</span>
      </TooltipAnchor>
      {ability.detailTarget && (
        <button
          type="button"
          onClick={() => onDetail(ability.detailTarget!)}
          aria-label={`Consultar ${ability.name} en la Enciclopedia`}
          className="tactile flex h-4 w-4 items-center justify-center rounded-full border border-iron-700 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
        >
          ⓘ
        </button>
      )}
    </span>
  )
}

/// Ficha de un enemigo — imagen, rol/facción/nivel, bio, atributos y habilidades resueltas
/// (rediseño de la vista de combate, 2026-07-28, petición explícita: "que al enemigo que clickeas
/// carge la imagen de este con una ficha de personaje con sus habilidades, pequeña descipción y
/// estadísticas"). Busca el enemigo por slug tanto en `npcs` (humanoides) como en `faunaFlora`
/// (fauna) — mismo slug que usa el motor de escena para los dos, ver worldCatalog.ts.
function EnemyFicha({
  slug,
  enciclopedia,
  onDetail,
}: {
  slug: string
  enciclopedia: EnciclopediaResponse | null
  onDetail: (target: NonNullable<ResolvedAbility['detailTarget']>) => void
}) {
  const [infoExpanded, setInfoExpanded] = useState(true)
  const target = useMemo(() => {
    if (!enciclopedia) return null
    const npc = enciclopedia.npcs.find((n) => n.slug === slug)
    if (npc) {
      return {
        name: npc.name,
        meta: `${npc.role}${npc.faction ? ` — ${npc.faction}` : ''} · nivel ${npc.level}`,
        bio: npc.bio,
        // Bug real jugando en vivo (2026-08-08, habilidad "Cazar" nueva): con Corretolvas en
        // combate, la ficha se quedó sin imagen — `imageUrls.banner` es null cuando la especie
        // solo tiene subida la variante de sexo (aquí, solo "macho"), mismo hueco ya arreglado en
        // 2026-07-24 para el banner bajo la narración (`mentionedEntityBanner.ts` §
        // resolveBannerUrl) pero nunca portado a esta ficha, escrita 4 días después sin el mismo
        // fallback.
        imageUrl: resolveImageUrl(npc.variantesSexo?.[0]?.imageUrls.banner ?? npc.imageUrls.banner),
        attributes: npc.attributes,
        abilities: resolveCombatAbilities({ level: npc.level, ataqueBase: npc.ataqueBase, raza: npc.raza, clase: npc.clase }, enciclopedia),
      }
    }
    const fauna = enciclopedia.faunaFlora.find((f) => f.sourceSlug === slug)
    if (fauna) {
      return {
        name: fauna.sourceName,
        meta: 'Fauna',
        bio: fauna.description ?? '',
        imageUrl: resolveImageUrl(fauna.variantesSexo?.[0]?.imageUrls.banner ?? fauna.imageUrls.banner),
        attributes: fauna.attributes ?? null,
        abilities: resolveCombatAbilities(
          { ataqueBase: fauna.ataqueBase, habilidadesRaciales: fauna.habilidadesRaciales, selfTarget: faunaFloraToDetailTarget(fauna) },
          enciclopedia,
        ),
      }
    }
    return null
  }, [enciclopedia, slug])

  if (!target) return null

  return (
    <div className="space-y-2.5">
      <h3 className="font-serif text-base text-wood-100">{target.name}</h3>
      {/* Colapsable (petición explícita, 2026-07-28: "que sea colapsable con un Legend que sea
          'Información'... también las estadísticas y habilidades del NPC") — mismo patrón visual
          que las clases colapsables de EnciclopediaPanel.tsx (cabecera con flecha que rota +
          contenido que aparece/desaparece debajo). Imagen/meta/bio/atributos/habilidades del
          enemigo viven todos aquí dentro — todo es "sobre él", nada usable por el jugador.*/}
      <div className="rounded-lg border border-iron-800">
        <button
          type="button"
          onClick={() => setInfoExpanded((v) => !v)}
          className="tactile flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-wood-950/40"
        >
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Información</p>
          <span className={`shrink-0 text-wood-500 transition-transform ${infoExpanded ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {infoExpanded && (
          <div className="space-y-2.5 border-t border-iron-800 px-2.5 py-2.5">
            {/* Mismo recorte que el banner de narración (LogPanel.tsx) — petición explícita:
                "que se vea bien como en la narración". `MediaSlot` (h-40, object-top) recortaba
                mal algunas imágenes; este aspect-ratio ancho es el que ya se ve bien en el log. */}
            {target.imageUrl ? (
              <div className="overflow-hidden rounded-lg border border-iron-700 bg-wood-950/60">
                <img src={target.imageUrl} alt="" className="aspect-[2.5/1] w-full object-cover" />
              </div>
            ) : (
              <MediaSlot icon="⚔️" variant="placeholder" />
            )}
            <p className="text-2xs uppercase tracking-[0.1em] text-wood-500">{target.meta}</p>
            {target.bio && <p className="text-xs leading-relaxed text-wood-300">{target.bio}</p>}
            {target.attributes && (
              <div>
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Estadísticas</p>
                {/* Rediseño (2026-07-30, "queda muy cargada de color") — punto de color en vez de
                    pastilla entera teñida, mismo criterio que AbilityChip/"Tus habilidades". */}
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(target.attributes) as (keyof typeof target.attributes)[]).map((attr) => (
                    <span
                      key={attr}
                      className="flex items-center gap-1.5 rounded-full border border-iron-700 bg-wood-950/50 px-2 py-0.5 font-mono text-2xs text-wood-300"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${attributeColorClasses[attr].dot}`} aria-hidden="true" />
                      {attributeLabels[attr]} {target.attributes![attr]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {target.abilities.length > 0 && (
              <div>
                <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Habilidades</p>
                <div className="flex flex-wrap gap-1.5">
                  {target.abilities.map((ability, i) => (
                    <AbilityChip key={`${ability.name}-${i}`} ability={ability} onDetail={onDetail} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/// Sustituye al LogPanel "El mundo" mientras dura el combate (rediseño de la vista de combate,
/// 2026-07-28, petición explícita: "quiero que la sección de combate salga sustituyendo a los
/// logs de mundo"). Absorbe todo lo que antes vivía en CombatComposer.tsx salvo el texto libre,
/// que se queda en la barra inferior (petición explícita: "la barra de abajo queda libre para el
/// texto") — el estado de selección vive en GameView.tsx, compartido entre este panel y esa barra.
export function CombatPanel({
  playerName,
  playerCondicion,
  energia,
  energiaMax,
  npcs,
  selectedNpcSlug,
  onSelectNpc,
  combatAbilities,
  selectedAbilityId,
  onSelectAbility,
  combatItems,
  selectedItemId,
  onSelectItem,
  busy,
  ended,
  awaitingDefense,
  lastInitiativeRoll,
  onActuar,
  onRegistrar,
  onDecapitarSeleccion,
  onHuir,
  onContinue,
  onSaquearSeleccion,
  onAbilityDetail,
  onItemDetail,
  enciclopedia,
}: CombatPanelProps) {
  const { onEntityDetail } = useEnciclopediaLink()
  // Modales de selección (petición explícita, 2026-07-30, tras probar en vivo el "Decapitar"/
  // "Saquear todo" de un solo clic: "tienes que marcar todos aquellos que quieras... un popup
  // donde marcando con checkbox puedas elegir y confirmarlo o cancelarlo").
  const [decapitarModalOpen, setDecapitarModalOpen] = useState(false)
  const [saquearModalOpen, setSaquearModalOpen] = useState(false)

  const incapacitados = npcs.filter((n) => n.condicion === 'INCAPACITADO')
  // Resumen de combate (2026-07-30) — solo se ofrece "Saquear todo" si de verdad queda algo sin
  // saquear (INCAPACITADO o MUERTO — un enemigo decapitado se puede saquear igual); si ya se
  // registró todo uno a uno durante la pelea, el resumen solo ofrece salir.
  //
  // Bug real (auditoría 2026-08-06): sin el filtro `enciclopedia?.npcs.some(...)`, un enemigo de
  // FAUNA derrotado también contaba como "lootable" — pero `lootOptions` de abajo solo mira
  // `enciclopedia.npcs` (nunca `enciclopedia.faunaFlora`, que ni siquiera tiene un campo `items`
  // con forma de loadout: la fauna se despieza por narración, harvest.ts, un mecanismo totalmente
  // aparte de este modal). Eso dejaba "Saquear todo" siempre visible tras derrotar fauna, abriendo
  // un modal sin ninguna opción que marcar — y como `fullyLootedSlugs` sale de `lootOptions`, esa
  // fauna nunca podía marcarse `yaSaqueado`, así que el botón reaparecía para siempre.
  const lootables = npcs.filter(
    (n) => (n.condicion === 'INCAPACITADO' || n.condicion === 'MUERTO') && !n.yaSaqueado && enciclopedia?.npcs.some((e) => e.slug === n.slug),
  )
  const quedaAlgoPorSaquear = lootables.length > 0

  // Opciones del modal de saqueo (2026-07-30) — el loadout real de cada enemigo saqueable viene
  // de la Enciclopedia (catálogo, no depende de la partida — ver `EnciclopediaNpcInfo.items`).
  // `id` compuesto (npc+objeto) para que dos enemigos con un objeto de mismo nombre no colisionen
  // en el checkbox, aunque al confirmar solo se manden los NOMBRES (lo que espera el backend).
  const lootOptions = lootables.flatMap((npc) => {
    const npcEnciclopedia = enciclopedia?.npcs.find((n) => n.slug === npc.slug)
    // Bug real (2026-07-31, "saqueé 2 de 3 y la próxima vez me volvía a listar las 3"): el
    // catálogo de la Enciclopedia no sabe nada de la partida — sin filtrar por lo que
    // `NpcState.lootedItemNames` ya registra como tomado, el modal ofrecía siempre el loadout
    // completo, aunque el backend correctamente ya no duplicara nada al confirmar.
    return (npcEnciclopedia?.items ?? [])
      .filter((item) => !npc.lootedItemNames.includes(item.name))
      .map((item) => ({
        id: `${npc.slug}:${item.name}`,
        label: item.cantidad > 1 ? `${item.name} ×${item.cantidad}` : item.name,
        sublabel: item.notas ?? `De ${npc.name}`,
        itemName: item.name,
        // Saqueo parcial (2026-07-31) — para saber, al confirmar, de qué NPC era cada opción y así
        // calcular qué NPCs tuvieron el 100% de sus objetos marcados.
        npcSlug: npc.slug,
      }))
  })

  return (
    <section className="plank-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
      <header className="relative flex items-center justify-between gap-2.5 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="gem animate-gem-breathe" />
          <h2 className="font-serif text-sm tracking-wide text-danger-400">⚔️ Combate</h2>
        </div>
        {!ended && !awaitingDefense && (
          <button onClick={onHuir} disabled={busy} className="text-2xs text-wood-400 transition-colors hover:text-accent-300 disabled:opacity-50">
            Huir
          </button>
        )}
      </header>

      {/* Barra de estado persistente (2026-07-29, "nunca queda claro el estado del enemigo...
          quiero saber cómo estamos ambos") — a diferencia de la lista de "Enemigos" de abajo,
          esta NUNCA se oculta en awaitingDefense: es justo cuando más falta hace verla. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-iron-800 px-4 pb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="max-w-24 truncate text-2xs text-wood-400">{playerName}</span>
          <HealthBar condicionFisica={playerCondicion} />
          <EnergyBar energia={energia} energiaMax={energiaMax} />
        </div>
        {npcs.map((npc) => (
          <div key={npc.slug} className="flex items-center gap-1.5">
            <span className="max-w-24 truncate text-2xs text-wood-400">{npc.name}</span>
            <HealthBar condicionFisica={npc.condicion} />
          </div>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {ended ? (
          // Resumen de combate (petición explícita, 2026-07-30: "no se entiende que vencí...
          // quiero una vista de victoria más vistosa y que no muestre el contenido del combate").
          // Sustituye TODO lo de abajo (Enemigos/Ficha/habilidades/Actuar) — ya no hace falta
          // nada de eso una vez la pelea terminó de verdad, solo el resultado y qué hacer después.
          // Bug real jugando en vivo (2026-07-31, "he ganado la batalla estando yo incapacitado
          // y el enemigo herido"): antes esta pantalla siempre decía "¡Victoria!" en cuanto el
          // ÚLTIMO enemigo caía, sin mirar si TÚ también habías caído en el proceso — un doble
          // K.O. se veía idéntico a una victoria limpia. Ahora distingue el caso: incapacitado
          // de verdad no es "victoria", aunque el enemigo también haya caído.
          <div
            className={`flex flex-col items-center gap-4 rounded-xl border p-5 text-center ${
              playerCondicion === 'INCAPACITADO'
                ? 'border-danger-500/40 bg-gradient-to-b from-danger-500/10 via-wood-950/20 to-transparent'
                : 'border-accent-500/40 bg-gradient-to-b from-accent-500/10 via-wood-950/20 to-transparent'
            }`}
          >
            <span className="animate-gem-breathe text-5xl" aria-hidden="true">
              {playerCondicion === 'INCAPACITADO' ? '⚠️' : '🏆'}
            </span>
            <div>
              <h3 className={`font-serif text-2xl tracking-wide ${playerCondicion === 'INCAPACITADO' ? 'text-danger-300' : 'text-accent-300'}`}>
                {playerCondicion === 'INCAPACITADO' ? 'Combate terminado' : '¡Victoria!'}
              </h3>
              <p className="mt-1 text-2xs uppercase tracking-[0.2em] text-wood-500">
                {playerCondicion === 'INCAPACITADO' ? 'Sales incapacitado de la pelea' : 'Combate terminado'}
              </p>
            </div>
            <ul className="w-full space-y-1.5">
              {npcs.map((npc) => (
                <li
                  key={npc.slug}
                  className="flex items-center justify-between gap-2 rounded-lg border border-iron-800 bg-wood-950/50 px-3 py-2 text-xs text-wood-200"
                >
                  <span className="truncate font-medium">{npc.name}</span>
                  <span className="shrink-0 text-2xs text-wood-500">
                    {CONDICION_LABEL[npc.condicion]}
                    {npc.yaSaqueado ? ' · saqueado' : ''}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex w-full gap-2">
              <button
                onClick={onContinue}
                disabled={busy}
                className="tactile flex-1 rounded-lg border border-iron-700 bg-wood-950/50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Salir
              </button>
              {incapacitados.length > 0 && (
                <button
                  onClick={() => setDecapitarModalOpen(true)}
                  disabled={busy}
                  className="tactile flex-1 rounded-lg border border-danger-600 bg-danger-600/20 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-danger-300 transition-colors hover:bg-danger-600/35 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Decapitar
                </button>
              )}
              {quedaAlgoPorSaquear && (
                <button
                  onClick={() => setSaquearModalOpen(true)}
                  disabled={busy}
                  className="tactile flex-1 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
                >
                  Saquear todo
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
        {playerCondicion === 'INCAPACITADO' && (
          // Petición explícita de la usuaria (2026-07-31, tras el bug del malus a 0 — ver
          // death.ts § CONDICION_MALUS): puedes seguir intentándolo estando incapacitado, pero
          // muy penalizado — y ahora se avisa con claridad en vez de dejarlo solo en la barra de
          // vida, fácil de pasar por alto en pleno combate.
          <div className="rounded-lg border border-danger-600/50 bg-danger-500/10 px-3 py-2 text-xs text-danger-200">
            ⚠️ Estás incapacitado — puedes seguir intentándolo, pero muy penalizado.
          </div>
        )}

        {awaitingDefense && (
          // Rediseño del turno de combate (2026-07-28, petición explícita: "turno de defensa
          // donde elige una habilidad a ciegas") — sin objetivo que elegir, es reactivo: el NPC
          // ya decidió su ataque, oculto, y espera la respuesta del jugador.
          <div className="rounded-lg border border-danger-600/50 bg-danger-500/10 px-3 py-2 text-xs text-danger-200">
            ⚔️ Un enemigo actúa primero — elige a ciegas cómo defenderte.
          </div>
        )}

        {!awaitingDefense && lastInitiativeRoll && (
          // Equivalente en el turno de ATAQUE al banner de arriba (2026-07-29, "el de defensa es
          // claro pero el de ataque no tanto, indícame qué salió en los dados") — mismos números
          // reales que decidieron la iniciativa, para que quede claro por qué te toca golpear
          // primero (o, si perdiste la tirada, por qué el próximo turno será de defensa a ciegas).
          <div className="rounded-lg border border-accent-600/40 bg-accent-500/5 px-3 py-2 text-xs text-wood-300">
            🎲 Iniciativa: tú {lastInitiativeRoll.jugadorTirada} vs {lastInitiativeRoll.npcTirada} del enemigo —{' '}
            {lastInitiativeRoll.ganador === 'jugador' ? 'actúas primero.' : 'el enemigo actuará primero en tu próximo turno.'}
          </div>
        )}

        {!awaitingDefense && (
          <div>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-wood-500">Enemigos</p>
            <div className="grid grid-cols-2 gap-2">
              {npcs.map((npc) => {
                const npcEnciclopedia =
                  enciclopedia?.npcs.find((n) => n.slug === npc.slug) ?? enciclopedia?.faunaFlora.find((f) => f.sourceSlug === npc.slug)
                // Mismo fallback de variante de sexo que EnemyFicha más arriba (bug real
                // jugando en vivo, 2026-08-08) — sin esto, esta miniatura también se queda vacía
                // para cualquier especie sin imagen "neutra" subida.
                const sexoVariant = npcEnciclopedia?.variantesSexo?.[0]
                const thumbnail = npcEnciclopedia
                  ? resolveImageUrl(sexoVariant?.imageUrls.thumbnail ?? sexoVariant?.imageUrls.banner ?? npcEnciclopedia.imageUrls.thumbnail ?? npcEnciclopedia.imageUrls.banner)
                  : null
                return (
                  <button
                    key={npc.slug}
                    type="button"
                    disabled={busy}
                    onClick={() => onSelectNpc(npc.slug)}
                    className={`tactile flex items-center gap-2 rounded-lg border p-1.5 text-left text-xs transition-colors disabled:opacity-60 ${
                      selectedNpcSlug === npc.slug ? 'border-accent-500 bg-accent-500/15' : 'border-iron-700 bg-wood-950/40 hover:border-accent-600/40'
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-wood-950/60">
                      {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover" /> : <span aria-hidden="true">⚔️</span>}
                    </span>
                    <span className="min-w-0">
                      <p className="truncate font-medium text-wood-100">{npc.name}</p>
                      <p className="text-2xs text-wood-400">{CONDICION_LABEL[npc.condicion]}</p>
                      {/* "Registrar" (solo este enemigo, instantáneo) sigue existiendo MIENTRAS el
                          combate sigue activo de verdad (p. ej. derrotaste a uno pero otros siguen
                          en pie). "Decapitar" (petición explícita, 2026-07-30: "un popup con
                          checkbox para elegir a quien decapitar") siempre abre el modal de
                          selección compartido, nunca actúa directo sobre este NPC en concreto —
                          por eso el enlace es el mismo aquí y en el resumen de victoria. */}
                      {npc.condicion === 'INCAPACITADO' && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {npc.yaSaqueado ? (
                            <span className="text-2xs text-wood-500">Ya saqueado</span>
                          ) : (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation()
                                onRegistrar(npc)
                              }}
                              className="inline-block text-2xs text-accent-300 underline"
                            >
                              Registrar
                            </span>
                          )}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDecapitarModalOpen(true)
                            }}
                            className="inline-block text-2xs text-danger-300 underline"
                          >
                            Decapitar
                          </span>
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!awaitingDefense && selectedNpcSlug && (
          <EnemyFicha
            slug={selectedNpcSlug}
            enciclopedia={enciclopedia}
            onDetail={(target) => onEntityDetail?.(target)}
          />
        )}

        {(combatAbilities.length > 0 || (!awaitingDefense && combatItems.length > 0)) && (
          // Bloque "usable" (petición explícita, 2026-07-28: "que destaque más... más claro que
          // son los elementos usables") — mismo tono accent que ya marca selección/foco en el
          // resto de la app, pero aquí permanente (no solo al seleccionar), para separarlo de
          // limpio de las secciones puramente informativas de arriba (Enemigos/Información).
          // En defensa a ciegas solo se ofrecen habilidades (petición explícita: "elige una
          // habilidad" para la "contra") — los objetos consumibles se ocultan en este sub-modo.
          //
          // Rediseño (petición explícita, 2026-07-30, tras verlo en vivo: "se ve fatal... no se
          // entiende nada... queda muy cargada de color"): antes cada habilidad era un chip con
          // el borde Y el texto enteros teñidos del color de su atributo (7 colores posibles a la
          // vez, en chips diminutos envueltos en una cuadrícula apretada) — un solo punto de color
          // por fila basta para seguir viendo el tipo de un vistazo, sin el efecto "confeti". Filas
          // en vez de chips envueltos: más fácil de leer de arriba abajo en un panel estrecho.
          <div className="space-y-3 rounded-lg border border-accent-600/50 bg-accent-500/5 p-2.5">
            {combatAbilities.length > 0 &&
              // Rediseño 2026-07-31 (petición explícita: "ataque básico no es una habilidad como
              // las demás, ni defenderse ni esquivar... son acciones que tienen todos los
              // personajes... en un bloque, y en otro las habilidades") — mismas filas de siempre,
              // solo agrupadas en dos bloques por `isGeneric` en vez de una lista plana. Genéricos
              // primero: son la acción por defecto de cualquier personaje.
              (
                [
                  { key: 'generic', label: awaitingDefense ? '🛡️ Elige cómo defenderte' : '⚔️ Acciones básicas', list: combatAbilities.filter((a) => a.isGeneric) },
                  { key: 'real', label: '⚡ Tus habilidades', list: combatAbilities.filter((a) => !a.isGeneric) },
                ] as const
              ).map(
                (group) =>
                  group.list.length > 0 && (
                    <div key={group.key}>
                      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-300">{group.label}</p>
                      <div className="space-y-1">
                        {group.list.map((a) => {
                          // Null en habilidades 'general' o en partidas de antes de este campo —
                          // cae de vuelta a un punto neutro, sin tinte de tipo.
                          const colors = a.preferredAttribute ? attributeColorClasses[a.preferredAttribute] : null
                          // Sistema de fatiga (2026-07-29, "aparecerá deshabilitada y solo podrás
                          // usar ataques normales o consumibles") — sin energía suficiente, el
                          // botón se deshabilita en vez de dejar elegirla.
                          const sinEnergia = a.energyCost > energia
                          const isSelected = selectedAbilityId === a.id
                          return (
                            <div
                              key={a.id}
                              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${
                                isSelected ? 'border-accent-500 bg-accent-500/15' : 'border-iron-700 bg-wood-950/50'
                              } ${sinEnergia ? 'opacity-50' : ''}`}
                            >
                              <TooltipAnchor text={a.description} className="min-w-0 flex-1">
                                <button
                                  onClick={() => {
                                    onSelectAbility(a.id)
                                    onSelectItem(null)
                                  }}
                                  disabled={busy || sinEnergia}
                                  title={sinEnergia ? 'No tienes energía suficiente' : undefined}
                                  className="tactile flex w-full items-center gap-2 text-left text-xs disabled:cursor-not-allowed"
                                >
                                  {/* Punto de color por atributo (2026-07-30) — sustituye al chip
                                      entero teñido: mismo dato de un vistazo, sin saturar la vista. */}
                                  <span
                                    className={`h-2 w-2 shrink-0 rounded-full ${colors ? colors.dot : 'bg-wood-600'}`}
                                    aria-hidden="true"
                                  />
                                  <span aria-hidden="true">{a.icon}</span>
                                  <span className={`truncate ${isSelected ? 'font-medium text-accent-100' : 'text-wood-200'}`}>{a.name}</span>
                                  {/* Doble arma (2026-07-31) — misma categoría en las dos manos: mejor dificultad al usarla, nunca un segundo golpe real. */}
                                  {a.dualWield && (
                                    <span
                                      className="shrink-0 rounded-full border border-accent-600/50 px-1 font-mono text-2xs text-accent-300"
                                      title="Llevas 2 armas de este tipo — mejor dificultad al usarla"
                                    >
                                      ×2
                                    </span>
                                  )}
                                  {a.energyCost > 0 && <span className="ml-auto shrink-0 font-mono text-2xs text-wood-500">⚡{a.energyCost}</span>}
                                </button>
                              </TooltipAnchor>
                              <button
                                type="button"
                                onClick={() => onAbilityDetail(a)}
                                aria-label={`Consultar ${a.name} en la Enciclopedia`}
                                className="tactile flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-iron-700 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                              >
                                ⓘ
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ),
              )}
            {!awaitingDefense && combatItems.length > 0 && (
              <div>
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-accent-300">⚡ Tus objetos</p>
                <div className="space-y-1">
                  {combatItems.map((item) => {
                    const isSelected = selectedItemId === item.id
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${
                          isSelected ? 'border-accent-500 bg-accent-500/15' : 'border-iron-700 bg-wood-950/50'
                        }`}
                      >
                        <TooltipAnchor text={item.description} className="min-w-0 flex-1">
                          <button
                            onClick={() => {
                              onSelectItem(item.id)
                              onSelectAbility(null)
                            }}
                            disabled={busy}
                            className="tactile flex w-full items-center gap-2 text-left text-xs disabled:cursor-not-allowed"
                          >
                            <span aria-hidden="true">🎒</span>
                            <span className={`truncate ${isSelected ? 'font-medium text-accent-100' : 'text-wood-200'}`}>{item.name}</span>
                          </button>
                        </TooltipAnchor>
                        <button
                          type="button"
                          onClick={() => onItemDetail(item)}
                          aria-label={`Consultar ${item.name} en la Enciclopedia`}
                          className="tactile flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-iron-700 text-2xs text-wood-500 transition-colors hover:border-accent-600/60 hover:text-accent-300"
                        >
                          ⓘ
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        <button
          onClick={onActuar}
          disabled={busy || (awaitingDefense ? !selectedAbilityId : !selectedAbilityId && !selectedItemId)}
          className="tactile w-full rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500"
        >
          {awaitingDefense ? 'Defenderte' : 'Actuar'}
        </button>
          </>
        )}
      </div>

      {decapitarModalOpen && (
        <CombatSelectionModal
          title="¿A quién decapitar?"
          description="Un golpe de gracia definitivo, sin tirada — no pueden resistir."
          options={incapacitados.map((npc) => ({ id: npc.slug, label: npc.name }))}
          confirmLabel="Decapitar"
          tone="danger"
          busy={busy}
          onCancel={() => setDecapitarModalOpen(false)}
          onConfirm={(selectedIds) => {
            onDecapitarSeleccion(incapacitados.filter((npc) => selectedIds.includes(npc.slug)))
            setDecapitarModalOpen(false)
          }}
        />
      )}

      {saquearModalOpen && (
        <CombatSelectionModal
          title="¿Qué te quieres quedar?"
          description="Solo se registrarán en tu inventario los objetos que marques."
          options={lootOptions}
          defaultSelectedIds={lootOptions.map((o) => o.id)}
          confirmLabel="Saquear"
          busy={busy}
          onCancel={() => setSaquearModalOpen(false)}
          onConfirm={(selectedIds) => {
            const selected = lootOptions.filter((o) => selectedIds.includes(o.id))
            const itemNames = [...new Set(selected.map((o) => o.itemName))]
            // Saqueo parcial (2026-07-31, "si no saqueas todo el botón sigue") — un NPC solo
            // cuenta como saqueado del todo si TODAS sus opciones (no solo alguna) están marcadas.
            // De `lootables`, NO de `lootOptions` (auditoría 2026-08-07, bug real: un PRINCIPAL
            // con loadout vacío en catálogo — Vrask Ombra, Kael Dorn... — no aporta NINGUNA opción
            // a `lootOptions`, así que nunca aparecía aquí y "Saquear todo" lo seguía ofreciendo
            // como pendiente para siempre, aunque no hubiera nada que marcar). `.every()` sobre un
            // array vacío de opciones ya da `true` — se cuenta como saqueado del todo sin más.
            const npcSlugs = lootables.map((n) => n.slug)
            const fullyLootedSlugs = npcSlugs.filter((slug) => lootOptions.filter((o) => o.npcSlug === slug).every((o) => selectedIds.includes(o.id)))
            // Bug real (2026-08-01, "saqueé 2 de 3 y me volvía a listar los 3"): el backend no
            // siempre manda `combateIniciado` de vuelta en un turno de saqueo (depende de que el
            // modelo repita el slug en su narración, algo que un saqueo — ahora 100% determinista,
            // sin LLM — nunca hace), así que GameView.tsx no puede fiarse de esa respuesta para
            // refrescar `lootedItemNames` — necesita saber, YA, qué se marcó de cada NPC.
            const itemNamesByNpc: Record<string, string[]> = {}
            for (const slug of npcSlugs) itemNamesByNpc[slug] = selected.filter((o) => o.npcSlug === slug).map((o) => o.itemName)
            onSaquearSeleccion(itemNames, fullyLootedSlugs, itemNamesByNpc)
            setSaquearModalOpen(false)
          }}
        />
      )}
    </section>
  )
}
