import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  createSavedAction,
  deleteSavedAction,
  updateSavedAction,
  setActiveCombatAbilities,
  createSkillBar,
  updateSkillBar,
  deleteSkillBar,
  setActiveSkillBar,
} from '../lib/api'
import { ABILITIES_REQUIEREN_MONTURA } from '../lib/abilitiesRequierenMontura'
import type { SkillHudView } from '../components/SkillBarMenu'
import type { DetailTarget } from '../components/DetailModal'
import type { PanelId } from '../components/NavTabs'
import type { ComposerChip, SavedActionCategory, SavedActionInfo, SkillBarInfo } from '../types'
import type { useActionModalsState } from './useActionModalsState'

// Bloque habilidades/barras de habilidades extraído de GameView.tsx (Fase 12 del plan, refactor
// puro, mismo patrón que useInventarioAcciones.ts): GameView sigue siendo dueño de `savedActions`,
// `skillBars`, `skillHudView` y `pendingComposerTextRef`; el hook los recibe como parámetros.
interface UseHabilidadesAccionesParams {
  saveId: string | null
  anyModalOpen: boolean
  skillHudView: SkillHudView
  editingSkillBar: SkillBarInfo | null
  pendingComposerTextRef: MutableRefObject<string | { chip: ComposerChip } | null>
  setSavedActions: Dispatch<SetStateAction<SavedActionInfo[]>>
  setActiveCombatAbilityNames: Dispatch<SetStateAction<string[]>>
  setDetailTarget: Dispatch<SetStateAction<DetailTarget | null>>
  setSkillBars: Dispatch<SetStateAction<SkillBarInfo[]>>
  setSkillHudView: Dispatch<SetStateAction<SkillHudView>>
  setEditingSkillBar: Dispatch<SetStateAction<SkillBarInfo | null>>
  setActivePanel: Dispatch<SetStateAction<PanelId | null>>
  setSimpleModal: ReturnType<typeof useActionModalsState>['setSimpleModal']
  setSaquearZonaModalOpen: (open: boolean) => void
  setHealModalOpen: (open: boolean) => void
  setHungerThirstModalOpen: (open: boolean) => void
  setEntregaModalOpen: (open: boolean) => void
  setAprenderOficioModalOpen: (open: boolean) => void
}

export function useHabilidadesAcciones({
  saveId,
  anyModalOpen,
  skillHudView,
  editingSkillBar,
  pendingComposerTextRef,
  setSavedActions,
  setActiveCombatAbilityNames,
  setDetailTarget,
  setSkillBars,
  setSkillHudView,
  setEditingSkillBar,
  setActivePanel,
  setSimpleModal,
  setSaquearZonaModalOpen,
  setHealModalOpen,
  setHungerThirstModalOpen,
  setEntregaModalOpen,
  setAprenderOficioModalOpen,
}: UseHabilidadesAccionesParams) {
  // `HarvestSelectionModal` se sigue reutilizando tal cual, ahora abierto desde el aviso de escena.

  // Paneles nuevos (2026-08-17) — pop-up de selección
  // real en vez del `promptText` incompleto que llevaban estas 2 habilidades desde su alta
  // original. "Saquear"/"Curar" no están aquí porque su confirmación es una forma distinta (manda
  // `lootItemNames`/`healItemUses` además del texto), ver `saquearZonaModalOpen`/`healModalOpen`.
  const SIMPLE_MODAL_ABILITY: Record<string, 'camp' | 'travel'> = {
    'Volver al campamento': 'camp',
    Viajar: 'travel',
  }

  async function handleCreateHabilidad(params: {
    name: string
    promptText: string
    icon: string
    description: string
    category: SavedActionCategory
  }) {
    if (!saveId) return
    const created = await createSavedAction(saveId, params)
    setSavedActions((prev) => [...prev, created])
  }

  // "Cinturón de combate" (2026-08-28) — optimista (el panel ya refleja el cambio al instante,
  // mismo criterio que handleDeleteHabilidad), con la respuesta REAL del backend (ya saneada) como
  // fuente de verdad al final, por si el cliente proponía algo que el backend descartó.
  async function handleSetActiveCombatAbilityNames(names: string[]) {
    if (!saveId) return
    setActiveCombatAbilityNames(names)
    const res = await setActiveCombatAbilities(saveId, names)
    setActiveCombatAbilityNames(res.activeCombatAbilityNames)
  }

  async function handleDeleteHabilidad(habilidadId: string) {
    if (!saveId) return
    setSavedActions((prev) => prev.filter((a) => a.id !== habilidadId))
    try {
      await deleteSavedAction(saveId, habilidadId)
    } catch {
      // Si falla, se resincroniza en la próxima carga de la partida.
    }
  }

  async function handleUpdateHabilidad(habilidadId: string, params: { name: string; promptText: string; icon: string; description: string }) {
    if (!saveId) return
    const updated = await updateSavedAction(saveId, habilidadId, params)
    setSavedActions((prev) => prev.map((a) => (a.id === habilidadId ? updated : a)))
    // Bug real (auditoría 2026-07-28): DetailModal vuelve a modo vista con el `target` que se le
    // pasó al abrirse, no con `savedActions` — sin esto, la ficha mostraba nombre/descripción
    // previos al cambio hasta cerrarla y reabrirla, aunque la lista de abajo ya estuviera al día.
    setDetailTarget((prev) => (prev?.kind === 'ability' && prev.ability.id === habilidadId ? { kind: 'ability', ability: updated } : prev))
  }

  function handleAttachAbility(ability: SavedActionInfo) {
    // Guard de exclusión mutua (A.2) — con otro modal de acción ya abierto (p. ej. post-combate,
    // modo dinámico), no se apila uno nuevo encima; el chip normal de la habilidad sigue disponible.
    if (anyModalOpen) return
    // "Viajar" requiere montura (2026-09-17, sin implementar todavía) — defensa en profundidad,
    // el botón ya sale deshabilitado en HabilidadesPanel.tsx/SkillBarHud.tsx (ver
    // ABILITIES_REQUIEREN_MONTURA), esto solo evita que un caller futuro que no pase por esos
    // componentes (o un bug de disabled) llegue a abrir el viaje real de todos modos.
    if (ABILITIES_REQUIEREN_MONTURA.has(ability.name)) return
    const simpleModalKind = SIMPLE_MODAL_ABILITY[ability.name]
    if (simpleModalKind) {
      setSimpleModal(simpleModalKind)
      setActivePanel(null)
      return
    }
    if (ability.name === 'Saquear') {
      setSaquearZonaModalOpen(true)
      setActivePanel(null)
      return
    }
    if (ability.name === 'Curar') {
      setHealModalOpen(true)
      setActivePanel(null)
      return
    }
    if (ability.name === 'Comer/Beber') {
      setHungerThirstModalOpen(true)
      setActivePanel(null)
      return
    }
    if (ability.name === 'Entregar') {
      setEntregaModalOpen(true)
      setActivePanel(null)
      return
    }
    // "Aprender oficio" retirada de startingAbilities.ts (2026-09-08, ver comentario ahí) — este
    // bloque se queda como fallback para partidas YA existentes que sembraron la habilidad antes
    // del cambio (SavedAction persiste por partida, no se retira retroactivamente). El camino real
    // en partidas nuevas es Interactuar con el Maestro (ABRIR_APRENDER_OFICIO, ver
    // handleChooseNpcInteraction más abajo), que abre el mismo modal.
    if (ability.name === 'Aprender oficio') {
      setAprenderOficioModalOpen(true)
      setActivePanel(null)
      return
    }
    // Bug real (2026-08-30, reportado jugando): las habilidades generales sin modal propio (barra
    // de habilidades, SkillBar.tsx) usaban `insertChip`, que CONCATENA al texto ya escrito en el
    // composer — igual que citar un NPC/objeto/lugar. La usuaria pidió lo contrario para este caso
    // concreto: pulsar una habilidad general debe SUSTITUIR cualquier texto ya escrito, no
    // añadirse a él (los chips de citar entidades, en cambio, siguen concatenando como siempre —
    // `setText` limpia el composer entero antes de escribir, a diferencia de `insertChip`).
    //
    // Segundo bug real, encontrado verificando el fix de arriba con Playwright (2026-08-30): con
    // la barra de habilidades desplegada, `ChatComposer` NI SIQUIERA está montado (se sustituye
    // entero por `SkillBarHud`, ver el JSX de más abajo) — `composerRef.current` era `null` en ese
    // momento, así que `setText` no hacía NADA en silencio. Coincide exactamente con lo reportado
    // ("al darle a una no hace nada"). Fix: guardar el texto pendiente y volver a texto libre — el
    // efecto de `pendingComposerTextRef` de arriba lo aplica en cuanto el composer se remonta de
    // verdad (cambiar de vista es asíncrono, `composerRef.current` seguiría `null` si se llamara
    // aquí mismo en la misma función).
    //
    // Hallazgo 39 (2026-09-07) — receta de CRAFTEO (`category === 'profesion'`, y no cayó ya en
    // ninguno de los modales especiales de arriba — Minar/Talar/Cazar/etc. también son
    // `'profesion'` pero abren su propio pop-up): mismo "sustituir, no concatenar" de siempre, pero
    // como CHIP (nombre corto + icono), no como texto plano largo pegado en el composer. El valor
    // real que lee el modelo (`promptText`) sigue viajando igual, solo cambia lo que se VE.
    if (ability.category === 'profesion') {
      pendingComposerTextRef.current = { chip: { icon: ability.icon, label: ability.name, description: ability.description, value: ability.promptText } }
      setSkillHudView({ screen: 'composer' })
      setActivePanel(null)
      return
    }
    pendingComposerTextRef.current = ability.promptText
    setSkillHudView({ screen: 'composer' })
    setActivePanel(null)
  }

  // Barras de habilidades múltiples (2026-09-04) — handlers del menú/editor, ver SkillBarMenu.tsx/
  // SkillBarEditor.tsx. `saveId` siempre existe aquí (los botones que disparan esto solo aparecen
  // con la partida ya cargada).
  function handleSelectSkillBar(bar: SkillBarInfo) {
    setSkillHudView({ screen: 'barra-activa', skillBarId: bar.id })
    if (saveId) void setActiveSkillBar(saveId, bar.id)
  }

  function handleBackToComposer() {
    setSkillHudView({ screen: 'composer' })
    if (saveId) void setActiveSkillBar(saveId, null)
  }

  async function handleCreateSkillBar() {
    if (!saveId) return
    const bar = await createSkillBar(saveId)
    setSkillBars((prev) => [...prev, bar])
  }

  async function handleSaveSkillBarEdit(params: { name?: string; abilityNames?: string[] }) {
    if (!saveId || !editingSkillBar) return
    const updated = await updateSkillBar(saveId, editingSkillBar.id, params)
    setSkillBars((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    setEditingSkillBar(null)
  }

  // Borrar una barra 2ª/3ª (2026-09-06, hallazgo 10) — nunca la base (`slotIndex: 0`), mismo guard
  // ya aplicado por el backend y por SkillBarMenu.tsx (que ni siquiera ofrece el botón para ella).
  // Si la barra borrada era la que se estaba viendo en el HUD, vuelve al listado de barras.
  async function handleDeleteSkillBar(bar: SkillBarInfo) {
    if (!saveId) return
    await deleteSkillBar(saveId, bar.id)
    setSkillBars((prev) => prev.filter((b) => b.id !== bar.id))
    if (skillHudView.screen === 'barra-activa' && skillHudView.skillBarId === bar.id) {
      setSkillHudView({ screen: 'menu-barras' })
    }
  }

  return {
    handleCreateHabilidad,
    handleSetActiveCombatAbilityNames,
    handleDeleteHabilidad,
    handleUpdateHabilidad,
    handleAttachAbility,
    handleSelectSkillBar,
    handleBackToComposer,
    handleCreateSkillBar,
    handleSaveSkillBarEdit,
    handleDeleteSkillBar,
  }
}
