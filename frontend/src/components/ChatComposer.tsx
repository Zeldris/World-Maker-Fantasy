import { useRef, type KeyboardEvent } from 'react'
import type { ComposerAttachment } from '../types'

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  suggestions?: string[]
  attachments?: ComposerAttachment[]
  onRemoveAttachment?: (index: number) => void
}

function attachmentLabel(attachment: ComposerAttachment): { icon: string; name: string } {
  return attachment.type === 'ability'
    ? { icon: attachment.ability.icon, name: attachment.ability.name }
    : { icon: '🎒', name: attachment.item.name }
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  suggestions,
  attachments = [],
  onRemoveAttachment,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canSubmit = (value.trim().length > 0 || attachments.length > 0) && !disabled

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSubmit) onSubmit()
    }
  }

  function autoGrow() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="border-t border-iron-800 bg-wood-950/90 px-4 pb-3 pt-3.5">
      {suggestions && suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onChange(s)}
              className="rounded-full border border-iron-700 bg-wood-900/70 px-3 py-1.5 text-xs text-wood-300 transition-colors hover:border-accent-600/60 hover:bg-accent-500/10 hover:text-accent-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="plank-panel relative flex flex-col gap-2 rounded-xl px-4 py-3 transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35),0_0_0_1px_var(--color-accent-500),0_0_20px_-6px_var(--color-accent-500)]">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((attachment, index) => {
              const { icon, name } = attachmentLabel(attachment)
              return (
                <span
                  key={`${attachment.type}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent-600/60 bg-accent-500/10 py-1 pl-2.5 pr-1.5 text-xs text-accent-300"
                >
                  <span>{icon}</span>
                  <span className="font-medium">{name}</span>
                  <button
                    onClick={() => onRemoveAttachment?.(index)}
                    aria-label={`Quitar ${name}`}
                    className="rounded-full px-1 text-accent-400 transition-colors hover:bg-accent-500/20 hover:text-accent-200"
                  >
                    ✕
                  </button>
                </span>
              )
            })}
          </div>
        )}
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              autoGrow()
            }}
            onKeyDown={handleKeyDown}
            placeholder={attachments.length > 0 ? 'Añade contexto (opcional)...' : '¿Qué hace tu personaje?'}
            rows={1}
            disabled={disabled}
            className="max-h-40 flex-1 resize-none bg-transparent text-sm text-wood-100 placeholder-wood-500 outline-none disabled:opacity-50"
          />
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="shrink-0 rounded-lg border border-accent-600 bg-gradient-to-b from-accent-400 to-accent-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-wood-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_10px_-3px_var(--color-accent-500)] transition-all hover:from-accent-300 hover:to-accent-500 disabled:cursor-not-allowed disabled:border-iron-700 disabled:from-wood-700 disabled:to-wood-700 disabled:text-wood-500 disabled:shadow-none"
          >
            Actuar
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-wood-600">
        Enter para enviar · Shift+Enter para salto de línea
      </p>
    </div>
  )
}
