import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ChatComposer } from './ChatComposer'

/// UX-13 (hito 0.1, roadmap-front-ux.md H11) — con una capa abierta encima (Clase, Especialización…
/// no atrapan el foco) el composer se deshabilita y además suelta el foco, para que `Enter` no
/// mande una acción por detrás del modal.
describe('ChatComposer — UX-13', () => {
  afterEach(() => {
    cleanup()
  })

  it('al deshabilitarse con el foco dentro, lo suelta', () => {
    const props = { onChange: vi.fn(), onSubmit: vi.fn() }
    const { container, rerender } = render(<ChatComposer {...props} />)
    const editor = container.querySelector('[contenteditable]') as HTMLElement
    editor.focus()
    expect(document.activeElement).toBe(editor)
    rerender(<ChatComposer {...props} disabled />)
    expect(document.activeElement).not.toBe(editor)
  })

  // P484 (QA-530): bloqueado en una escena, el propio campo dice por qué en vez de no hacer nada.
  it('deshabilitado con motivo: el placeholder dice el motivo', () => {
    const props = { onChange: vi.fn(), onSubmit: vi.fn() }
    const { container } = render(<ChatComposer {...props} disabled disabledReason="Estás en mitad de una escena" />)
    const editor = container.querySelector('[contenteditable]') as HTMLElement
    expect(editor.getAttribute('data-placeholder')).toBe('Estás en mitad de una escena')
  })
})
