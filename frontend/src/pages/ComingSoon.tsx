import { useNavigate } from 'react-router-dom'

export function ComingSoon() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-iron-700 bg-iron-800 text-3xl shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
        🛡️
      </span>
      <h1 className="font-serif text-3xl text-wood-100">Multijugador — próximamente</h1>
      <p className="max-w-md text-sm leading-relaxed text-wood-400">
        El modo multijugador (salas compartidas) todavía está en diseño. El MVP se centra primero en pulir el
        modo en solitario.
      </p>
      <button type="button"
        onClick={() => navigate('/')}
        className="mt-2 rounded-full border border-iron-700 bg-wood-900/60 px-4 py-2 text-sm text-moss-400 transition-colors hover:border-moss-600/60 hover:bg-moss-500/10 hover:text-moss-400"
      >
        ← Volver al inicio
      </button>
    </div>
  )
}
