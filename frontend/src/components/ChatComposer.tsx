import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react'
import type { ComposerChip } from '../types'

export interface ChatComposerHandle {
  insertChip: (chip: ComposerChip) => void
  clear: () => void
  /// Sugerencias de próxima acción (petición explícita, 2026-08-15) — a diferencia de `insertChip`
  /// (un elemento fijo tipo chip, pensado para referenciar una entidad concreta), esto REEMPLAZA
  /// todo el contenido por texto plano libre y editable: la jugadora eligió una sugerencia como
  /// punto de partida, pero tiene que poder seguir escribiendo/corrigiéndola como si la hubiera
  /// tecleado ella misma.
  setText: (text: string) => void
}

interface ChatComposerProps {
  onChange?: (text: string) => void
  onSubmit: (text: string) => void
  disabled?: boolean
  /// Botón secundario "Sugerir" (petición explícita, 2026-08-15) — llamada aparte que genera
  /// sugerencias bajo demanda, ver `SuggestionBar.tsx`/`GameView.tsx`. Solo se renderiza si
  /// `GameView.tsx` pasa este callback (p. ej. nunca durante combate) — `ChatComposer` no sabe nada
  /// de sugerencias más allá de disparar el callback y mostrar el estado de carga.
  onRequestSuggestions?: () => void
  suggestionsLoading?: boolean
}

// Dos datasets separados a propósito: `chipLabel` marca "esto es un chip" y sirve de display;
// `chipValue` es el texto real que se manda al backend — para una habilidad son cosas distintas
// (nombre corto vs. promptText completo, ver ComposerChip en types.ts).
const CHIP_MARKER_KEY = 'chipLabel'
const CHIP_VALUE_KEY = 'chipValue'
// Espacio en blanco insertado tras cada chip para separarlo visualmente del texto siguiente sin
// que el navegador lo colapse (a diferencia de un espacio normal, que sí puede perderse en los
// bordes de un nodo contenteditable).
const CHIP_SPACER = ' '

function buildChipNode(chip: ComposerChip): HTMLSpanElement {
  const span = document.createElement('span')
  span.contentEditable = 'false'
  span.dataset[CHIP_MARKER_KEY] = chip.label
  span.dataset[CHIP_VALUE_KEY] = chip.value ?? chip.label
  span.className =
    'chip-inline relative inline-flex items-center gap-1 rounded-full border border-accent-600/60 bg-accent-500/10 px-2 py-0.5 align-baseline text-xs text-accent-300'

  const iconSpan = document.createElement('span')
  iconSpan.textContent = chip.icon
  const nameSpan = document.createElement('span')
  nameSpan.className = 'font-medium'
  nameSpan.textContent = chip.label
  span.append(iconSpan, nameSpan)

  if (chip.description) {
    const tooltip = document.createElement('span')
    tooltip.className = 'chip-tooltip'
    tooltip.textContent = chip.description
    span.appendChild(tooltip)
  }
  return span
}

// Serializa el contenido mixto (texto libre + chips) a un único string plano: cada chip aporta su
// `value` (no su `label` visible) entre comillas — para una habilidad es el promptText completo de
// la acción, no solo su nombre corto (bug real 2026-07-21, ver comentario de ComposerChip.value).
function serialize(root: HTMLElement): string {
  let text = ''
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ''
    } else if (node instanceof HTMLElement && node.tagName === 'BR') {
      text += '\n'
    } else if (node instanceof HTMLElement && node.dataset[CHIP_VALUE_KEY] !== undefined) {
      text += `'${node.dataset[CHIP_VALUE_KEY]}'`
    } else {
      text += node.textContent ?? ''
    }
  }
  return text.replace(/ /g, ' ')
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  { onChange, onSubmit, disabled, onRequestSuggestions, suggestionsLoading },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const [hasContent, setHasContent] = useState(false)
  const canSubmit = hasContent && !disabled

  // "El arma se desenfunda" (roadmap de animaciones, item 11): pop sutil solo en el instante en
  // que Actuar pasa de deshabilitado a disponible, nunca en el resto de renders.
  const [justEnabled, setJustEnabled] = useState(false)
  const wasSubmittableRef = useRef(canSubmit)
  useEffect(() => {
    if (!wasSubmittableRef.current && canSubmit) {
      setJustEnabled(true)
      const timer = setTimeout(() => setJustEnabled(false), 250)
      wasSubmittableRef.current = canSubmit
      return () => clearTimeout(timer)
    }
    wasSubmittableRef.current = canSubmit
  }, [canSubmit])

  function saveSelection() {
    const el = editorRef.current
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (el.contains(range.startContainer)) {
      savedRangeRef.current = range.cloneRange()
    }
  }

  function handleInput() {
    const el = editorRef.current
    if (!el) return
    // Limpia el <br> huérfano que algunos navegadores dejan tras borrar todo el contenido, para
    // que el placeholder (CSS :empty) vuelva a mostrarse.
    if (el.textContent === '' && el.childNodes.length > 0) {
      el.innerHTML = ''
    }
    const text = serialize(el)
    setHasContent(text.trim().length > 0)
    onChange?.(text)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      triggerSubmit()
    }
  }

  function triggerSubmit() {
    const el = editorRef.current
    if (!el || disabled) return
    const text = serialize(el).trim()
    if (!text) return
    onSubmit(text)
  }

  useImperativeHandle(ref, () => ({
    insertChip(chip: ComposerChip) {
      const el = editorRef.current
      if (!el) return
      el.focus()
      const sel = window.getSelection()
      let range: Range
      if (savedRangeRef.current && el.contains(savedRangeRef.current.startContainer)) {
        range = savedRangeRef.current
      } else {
        range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
      }
      sel?.removeAllRanges()
      sel?.addRange(range)

      const chipNode = buildChipNode(chip)
      range.deleteContents()
      range.insertNode(chipNode)
      const spacer = document.createTextNode(CHIP_SPACER)
      chipNode.after(spacer)

      const newRange = document.createRange()
      newRange.setStartAfter(spacer)
      newRange.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(newRange)
      savedRangeRef.current = newRange.cloneRange()

      handleInput()
    },
    clear() {
      const el = editorRef.current
      if (!el) return
      el.innerHTML = ''
      savedRangeRef.current = null
      handleInput()
    },
    setText(text: string) {
      const el = editorRef.current
      if (!el) return
      el.innerHTML = ''
      el.appendChild(document.createTextNode(text))
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      savedRangeRef.current = range.cloneRange()
      handleInput()
    },
  }))

  return (
    <div className="border-t border-iron-800 bg-wood-950/90 px-4 pb-3 pt-3.5">
      <div className="plank-panel relative flex flex-col gap-2 rounded-xl px-4 py-3 transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35),0_0_0_1px_var(--color-accent-500),0_0_20px_-6px_var(--color-accent-500)]">
        <div className="flex items-end gap-3">
          <div
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onBlur={saveSelection}
            data-placeholder="¿Qué hace tu personaje?"
            className={`composer-editable max-h-40 flex-1 overflow-y-auto whitespace-pre-wrap break-words bg-transparent text-sm text-wood-100 outline-none ${
              disabled ? 'opacity-50' : ''
            }`}
          />
          {onRequestSuggestions && (
            <button
              onClick={onRequestSuggestions}
              disabled={disabled || suggestionsLoading}
              className="tactile shrink-0 rounded-lg border border-iron-700 bg-wood-950/50 px-3 py-2 text-xs font-semibold text-wood-300 transition-colors hover:border-accent-600/60 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {suggestionsLoading ? 'Pensando...' : '💡 Sugerir'}
            </button>
          )}
          <button
            onClick={triggerSubmit}
            disabled={!canSubmit}
            className={`tactile shrink-0 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_10px_-3px_var(--color-accent-500)] transition-all hover:from-accent-300 hover:to-accent-500 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500 disabled:shadow-none ${
              justEnabled ? 'animate-pop-subtle' : ''
            }`}
          >
            Actuar
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-2xs text-wood-400">
        Enter para enviar · Shift+Enter para salto de línea · haz clic en una habilidad/objeto para insertarlo aquí
      </p>
    </div>
  )
})
