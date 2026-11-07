import { describe, it, expect, vi, afterEach } from 'vitest'
import { requestImagePrompt, type ImagePromptEstado } from './api'

/// IMG-50 — sin caché, el POST devuelve 202 con el estado de la cola y se pregunta por él hasta que acaba.
const respuesta = (cuerpo: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => cuerpo }) as Response

describe('requestImagePrompt — IMG-50', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('con caché devuelve el prompt sin sondear', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ prompt: 'p', provider: 'x', cached: true }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await requestImagePrompt('w', 'fauna', 'a', 'banner')).toEqual({ prompt: 'p', provider: 'x', cached: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('en cola: avisa de cada estado y devuelve el prompt al acabar', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respuesta({ estado: 'en_cola', posicion: 1 }, 202))
      .mockResolvedValueOnce(respuesta({ estado: 'generando' }))
      .mockResolvedValueOnce(respuesta({ estado: 'listo', prompt: 'p', provider: 'ollama:m' }))
    vi.stubGlobal('fetch', fetchMock)
    const vistos: ImagePromptEstado[] = []
    const r = await requestImagePrompt('w', 'fauna', 'a', 'banner', false, (e) => vistos.push(e), 1)
    expect(r).toEqual({ prompt: 'p', provider: 'ollama:m', cached: false })
    expect(vistos.map((e) => e.estado)).toEqual(['en_cola', 'generando'])
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/world\/w\/image-prompt\/estado\?entityType=fauna&entitySlug=a&sizeProfile=banner$/)
  })

  it('si el modelo falla, lanza su motivo', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ estado: 'en_cola', posicion: 1 }, 202))
        .mockResolvedValueOnce(respuesta({ estado: 'error', error: 'usa «moon»' })),
    )
    await expect(requestImagePrompt('w', 'fauna', 'a', 'banner', false, undefined, 1)).rejects.toThrow('usa «moon»')
  })
})
