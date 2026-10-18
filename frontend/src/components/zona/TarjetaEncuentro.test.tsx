import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { TarjetaEncuentro, altoDeTarjeta } from './MenuFicha'
import type { PresentacionOferta } from '../../lib/ofertaModoDinamico'

function tarjeta(labels: string[], onClick = vi.fn()): PresentacionOferta {
  return { tone: 'accent2', icon: '🗣️', title: 'Maestro Herrero Serhu', subtitle: '¿Qué quieres hacer?', actions: labels.map((label) => ({ label, tone: 'primary' as const, onClick: label === 'Salir' || label === 'Ignorar' ? onClick : vi.fn() })) }
}

describe('TarjetaEncuentro', () => {
  afterEach(() => cleanup())

  // P198 (QA-27): con 8 opciones la tarjeta enseñaba solo 4; ahora crece con ellas.
  it('crece con las opciones y el aviso, y hace scroll si aun así no caben', () => {
    const ocho = tarjeta(['Charlar', 'Aprender profesión', '¿Tienes trabajo?', '¿Qué se cuenta?', 'Proponer', 'Pedirle que te informe', 'Combatir', 'Salir'])
    expect(altoDeTarjeta(ocho)).toBeGreaterThan(altoDeTarjeta(tarjeta(['Interactuar', 'Ignorar'])))
    expect(altoDeTarjeta({ ...ocho, warning: { nivel: 'alto', text: 'x' } })).toBeGreaterThan(altoDeTarjeta(ocho))
    const { getByTestId } = render(<svg><TarjetaEncuentro x={100} y={100} escala={1} presentacion={ocho} /></svg>)
    const fo = getByTestId('encuentro-en-mapa')
    expect(Number(fo.getAttribute('height'))).toBe(altoDeTarjeta(ocho))
    expect((fo.firstElementChild as HTMLElement).className).toContain('overflow-y-auto')
  })

  // P202 (QA-27): Escape cierra la tarjeta con su «Salir» o su «Ignorar»; sin ninguno, no hace nada.
  it('Escape pulsa «Salir» o «Ignorar»; con alguien que te corta el paso, nada', () => {
    const salir = vi.fn()
    render(<svg><TarjetaEncuentro x={0} y={0} escala={1} presentacion={tarjeta(['Charlar', 'Salir'], salir)} /></svg>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(salir).toHaveBeenCalledTimes(1)
    cleanup()
    const fuera = vi.fn()
    window.addEventListener('keydown', fuera)
    render(<svg><TarjetaEncuentro x={0} y={0} escala={1} presentacion={tarjeta(['Combatir', 'Huir'])} /></svg>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(fuera).toHaveBeenCalledTimes(1)
    window.removeEventListener('keydown', fuera)
  })
})
