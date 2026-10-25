import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useEncuentroForzado } from './useEncuentroForzado'
import { calcularFase, canDo } from '../lib/gamePhase'

const tarjeta = { dynamicModeOffer: { combateForzado: true as const } }
const sinTarjeta = { dynamicModeOffer: undefined }

/// P116 (cierre de la tanda Zona): el botón «Viajar» (ZonaSalidaModal y TravelDestinationModal) se
/// bloquea con `puede('moverse')`, que sale de `encuentroPendiente`. El servidor decide con la oferta
/// guardada (`pendingDynamicModeOffer.combateForzado`, que llega en `SaveDetail`), no con la tarjeta
/// del registro: las dos tienen que contar.
describe('useEncuentroForzado', () => {
  it('sin oferta guardada ni tarjeta: libre', () => {
    const { result } = renderHook(() => useEncuentroForzado([sinTarjeta]))
    expect(result.current.encuentroForzado).toBe(false)
  })

  it('con la oferta guardada y el registro sin tarjeta (p. ej. vacío tras recargar), el servidor bloquea y el cliente también', () => {
    const { result } = renderHook(() => useEncuentroForzado([]))
    act(() => result.current.guardarOferta({ combateForzado: true }))
    expect(result.current.encuentroForzado).toBe(true)
    // …y el botón sale bloqueado con el motivo de la matriz de permisos.
    const fase = calcularFase({ terminada: false, muertePendiente: false, enCombate: false, modoDinamico: false, narradorEscribiendo: false, eleccionAbierta: false, encuentroPendiente: result.current.encuentroForzado, ocupado: false })
    expect(canDo(fase, 'moverse')).toEqual({ permitido: false, motivo: 'Primero reacciona a quien te corta el paso.' })
  })

  it('una oferta guardada que no es de combate forzado, o ninguna, no bloquea', () => {
    const { result } = renderHook(() => useEncuentroForzado([]))
    act(() => result.current.guardarOferta({}))
    expect(result.current.encuentroForzado).toBe(false)
    act(() => result.current.guardarOferta(null))
    expect(result.current.encuentroForzado).toBe(false)
  })

  it('la tarjeta viva del registro sigue bloqueando sin oferta guardada (encuentro recién cortado en el mapa)', () => {
    const { result } = renderHook(() => useEncuentroForzado([tarjeta]))
    expect(result.current.encuentroForzado).toBe(true)
  })

  it('al resolverse la tarjeta (Interactuar) la oferta guardada de la última carga ya no bloquea', () => {
    let log: { dynamicModeOffer?: { combateForzado?: boolean } }[] = [tarjeta]
    const { result, rerender } = renderHook(() => useEncuentroForzado(log))
    act(() => result.current.guardarOferta({ combateForzado: true }))
    expect(result.current.encuentroForzado).toBe(true)
    log = [sinTarjeta]
    rerender()
    expect(result.current.encuentroForzado).toBe(false)
  })

  // Leve de la revisión de la tanda Zona: la oferta guardada con el registro sin tarjeta (registro
  // vacío: la tarjeta se cuelga de la última entrada, así que sin entradas no hay tarjeta que
  // resolver) no se olvida por el efecto de la tarjeta, porque esa tarjeta nunca existió. Se olvida
  // cuando el save recargado ya no la trae: `syncFromSave` llama a `guardarOferta(save.pendingDynamicModeOffer)`
  // en cada carga y resincronización, y con `null` queda libre.
  it('con la oferta guardada y sin tarjeta, un save recargado que ya no la trae la olvida', () => {
    const { result } = renderHook(() => useEncuentroForzado([]))
    act(() => result.current.guardarOferta({ combateForzado: true }))
    expect(result.current.encuentroForzado).toBe(true)
    act(() => result.current.guardarOferta(undefined))
    expect(result.current.encuentroForzado).toBe(false)
  })
})
