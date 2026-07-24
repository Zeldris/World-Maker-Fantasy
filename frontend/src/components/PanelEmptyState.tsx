// Estado vacío compartido (2026-07-19, auditoría de frontend): antes cada panel tenía su propio
// estilo de "todavía no hay nada" — unos con icono en círculo y borde discontinuo (Misiones,
// Reino), otros con una simple frase en cursiva (Compañeros, Diario, Inventario). Un solo
// componente para que el cajón se sienta como una app, no dos, cambies a la pestaña que cambies.
interface PanelEmptyStateProps {
  icon: string
  title: string
  hint: string
}

export function PanelEmptyState({ icon, title, hint }: PanelEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-iron-700 bg-wood-950/40 px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-iron-700 bg-iron-800 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
        {icon}
      </span>
      <p className="font-serif text-sm tracking-wide text-wood-300">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-wood-400">{hint}</p>
    </div>
  )
}
