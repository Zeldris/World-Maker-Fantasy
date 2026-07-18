const reasons: Record<string, string> = {
  misiones: 'Objetivos activos y completados — necesita un modelo de datos nuevo (Quest) que todavía no existe.',
}

export function PlaceholderPanel({ id }: { id: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-iron-700 bg-wood-950/40 px-6 py-10 text-center">
      <span className="flex h-10 w-10 rotate-45 items-center justify-center rounded-md border border-iron-700 bg-wood-900 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
        <span className="-rotate-45 text-lg leading-none text-wood-600">·</span>
      </span>
      <p className="font-serif text-sm tracking-wide text-wood-300">Todavía no hay nada aquí</p>
      <p className="max-w-sm text-xs leading-relaxed text-wood-500">{reasons[id] ?? 'Pendiente de construir.'}</p>
    </div>
  )
}
