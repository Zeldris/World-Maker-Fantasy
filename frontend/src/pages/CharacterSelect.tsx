import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { pregeneratedCharacters, worlds } from '../data/mock'
import { useSession } from '../context/SessionContext'
import { CharacterCard } from '../components/CharacterCard'
import { Button } from '../components/Button'
import { StepDots } from '../components/StepDots'
import { PanelRivets } from '../components/Rivet'
import { attributeLabels } from '../lib/dice'
import type { Attribute, AttributeBlock, Character } from '../types'

const emptyAttributes: AttributeBlock = {
  fuerza: 8,
  destreza: 8,
  sigilo: 8,
  voluntad: 8,
  carisma: 8,
  arcano: 8,
}

const POINT_BUDGET = 60

export function CharacterSelect() {
  const navigate = useNavigate()
  const { worldId } = useParams()
  const { selectedCharacter, setSelectedWorld, setSelectedCharacter } = useSession()
  const world = worlds.find((w) => w.id === worldId) ?? null
  const [tab, setTab] = useState<'pregen' | 'custom'>('pregen')

  useEffect(() => {
    if (world) setSelectedWorld(world)
  }, [world])

  const [name, setName] = useState('')
  const [archetype, setArchetype] = useState('')
  const [motivation, setMotivation] = useState('')
  const [attributes, setAttributes] = useState<AttributeBlock>(emptyAttributes)

  const spent = Object.values(attributes).reduce((a, b) => a + b, 0)
  const remaining = POINT_BUDGET - spent

  function updateAttribute(attr: Attribute, value: number) {
    setAttributes((prev) => ({ ...prev, [attr]: value }))
  }

  function confirmCustom() {
    const custom: Character = {
      id: `custom-${Date.now()}`,
      name: name || 'Sin nombre',
      archetype: archetype || 'Aventurero',
      origin: 'Personaje creado desde cero.',
      motivation: motivation || 'Todavía por descubrir.',
      attributes,
      isPregenerated: false,
      portraitInitial: (name || '?').charAt(0).toUpperCase(),
    }
    setSelectedCharacter(custom)
  }

  if (!world) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-wood-400">Primero tienes que elegir un mundo.</p>
        <Button onClick={() => navigate('/solitario')}>Elegir mundo</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <button onClick={() => navigate('/solitario')} className="mb-2 text-xs text-wood-500 transition-colors hover:text-accent-300">
          ← Volver
        </button>
        <div className="flex items-center gap-3">
          <StepDots current={2} />
          <p className="text-xs tracking-[0.2em] text-accent-400 uppercase">Paso 2 de 3 — {world.name}</p>
        </div>
        <h1 className="mt-1.5 font-serif text-3xl text-wood-100">Elige tu personaje</h1>
      </div>

      <div className="flex gap-2 border-b border-iron-700">
        <button
          onClick={() => setTab('pregen')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'pregen'
              ? 'border-accent-500 font-medium text-accent-300'
              : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Preseleccionados
        </button>
        <button
          onClick={() => setTab('custom')}
          className={`border-b-2 px-3 py-2 text-sm transition-colors ${
            tab === 'custom'
              ? 'border-accent-500 font-medium text-accent-300'
              : 'border-transparent text-wood-400 hover:text-wood-200'
          }`}
        >
          Crear desde cero
        </button>
      </div>

      {tab === 'pregen' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pregeneratedCharacters.map((c, i) => (
            <div key={c.id} className="animate-entry-in" style={{ animationDelay: `${i * 60}ms` }}>
              <CharacterCard character={c} selected={selectedCharacter?.id === c.id} onSelect={() => setSelectedCharacter(c)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="plank-panel relative flex flex-col gap-5 rounded-xl p-6">
          <PanelRivets />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-wood-300">
              Nombre
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-wood-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition-colors placeholder:text-wood-600 focus:border-accent-500"
                placeholder="Nombre de tu personaje"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-wood-300">
              Arquetipo
              <input
                value={archetype}
                onChange={(e) => setArchetype(e.target.value)}
                className="rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-wood-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition-colors placeholder:text-wood-600 focus:border-accent-500"
                placeholder="Ej. Ladrona, clérigo, mercenario..."
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-wood-300">
            Motivación
            <input
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              className="rounded-lg border border-iron-700 bg-wood-950/60 px-3 py-2 text-wood-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition-colors placeholder:text-wood-600 focus:border-accent-500"
              placeholder="¿Qué persigue tu personaje?"
            />
          </label>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-wood-400">Atributos</p>
              <span className="h-px flex-1 bg-iron-700" />
              <p
                className={`rounded-full border px-2.5 py-0.5 font-mono text-xs ${
                  remaining < 0
                    ? 'border-red-800 bg-red-500/10 text-red-400'
                    : 'border-iron-700 bg-wood-950/60 text-accent-300'
                }`}
              >
                {remaining} / {POINT_BUDGET} pts
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(Object.keys(attributes) as Attribute[]).map((attr) => (
                <label key={attr} className="flex flex-col gap-1 text-xs text-wood-300">
                  <span className="flex items-center justify-between">
                    {attributeLabels[attr]} <span className="font-mono text-wood-200">{attributes[attr]}</span>
                  </span>
                  <input
                    type="range"
                    min={4}
                    max={18}
                    value={attributes[attr]}
                    onChange={(e) => updateAttribute(attr, Number(e.target.value))}
                    className="accent-[var(--color-accent-500)]"
                  />
                </label>
              ))}
            </div>
          </div>

          <Button variant="secondary" onClick={confirmCustom} disabled={!name || remaining < 0}>
            Confirmar personaje
          </Button>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          disabled={!selectedCharacter}
          onClick={() => navigate(`/solitario/mundo/${world.id}/personaje/${selectedCharacter!.id}`)}
        >
          Continuar →
        </Button>
      </div>
    </div>
  )
}
