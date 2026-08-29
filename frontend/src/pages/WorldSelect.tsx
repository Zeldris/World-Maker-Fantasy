import { useNavigate } from 'react-router-dom'
import { worlds } from '../data/mock'
import { useSession } from '../context/useSession'
import { WorldCard } from '../components/WorldCard'
import { Button } from '../components/Button'
import { StepDots } from '../components/StepDots'

export function WorldSelect() {
  const navigate = useNavigate()
  const { selectedWorld, setSelectedWorld } = useSession()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <button type="button" onClick={() => navigate('/')} className="mb-2 text-xs text-wood-500 transition-colors hover:text-accent-300">
          ← Volver
        </button>
        <div className="flex items-center gap-3">
          <StepDots current={1} />
          <p className="text-xs tracking-[0.2em] text-accent-400 uppercase">Paso 1 de 3</p>
        </div>
        <h1 className="mt-1.5 font-serif text-3xl text-wood-100">Elige un mundo</h1>
        <p className="mt-1 text-sm text-wood-400">La ambientación de tu partida. Por ahora solo hay uno disponible.</p>
      </div>

      <div className="flex flex-col gap-4">
        {worlds.map((world, i) => (
          <div key={world.id} className="animate-entry-in" style={{ animationDelay: `${i * 60}ms` }}>
            <WorldCard world={world} selected={selectedWorld?.id === world.id} onSelect={() => setSelectedWorld(world)} />
          </div>
        ))}
        <div className="rounded-xl border border-dashed border-iron-700 bg-wood-950/40 px-5 py-10 text-center text-sm text-wood-500">
          Más mundos por llegar.
        </div>
      </div>

      <div className="flex justify-end">
        <Button disabled={!selectedWorld} onClick={() => navigate(`/solitario/mundo/${selectedWorld!.id}`)}>
          Continuar →
        </Button>
      </div>
    </div>
  )
}
