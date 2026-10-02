import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chip } from '../components/base/Chip'
import { ProgressBar } from '../components/base/ProgressBar'
import { Tabs } from '../components/base/Tabs'
import { EntityRow } from '../components/base/EntityRow'
import { QuantityStepper } from '../components/QuantityStepper'
import { CargandoModal, ErrorCarga, ExitoModal } from '../components/EstadosModal'
import { BotonMantener } from '../components/BotonMantener'
import { OfferCard } from '../components/OfferCard'
import { ModalShell, type TamanoModal } from '../components/ModalShell'
import { Notificaciones } from '../components/Notificaciones'
import { BotonAjustes } from '../components/BotonAjustes'

// BAS-9 (hito 0.2, roadmap-front.md § 3) — catálogo visual: pinta los componentes base y sus estados
// (vacío, cargando, error, deshabilitado) para revisar el diseño sin jugar. Solo admin, sin enlace
// en flujos de jugador (mismo criterio que /admin/enciclopedia); sustituye a Storybook sin
// dependencias nuevas.

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-iron-800 bg-wood-950/40 p-4">
      <h2 className="font-serif text-sm tracking-wide text-accent-300">{titulo}</h2>
      {children}
    </section>
  )
}

export function AdminUI() {
  const navigate = useNavigate()
  const [pct, setPct] = useState(80)
  const [pestana, setPestana] = useState<'a' | 'b' | 'c'>('a')
  const [cantidad, setCantidad] = useState(1)
  const [modal, setModal] = useState<TamanoModal | null>(null)
  const [mantenido, setMantenido] = useState(0)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <button type="button" onClick={() => navigate(-1)} className="mb-1 text-xs text-wood-500 transition-colors hover:text-accent-300">
            ← Volver
          </button>
          <h1 className="font-serif text-2xl text-wood-100">Catálogo de interfaz (admin)</h1>
          <p className="text-sm text-wood-400">Componentes base y sus estados. Los ajustes (⚙️) se aplican aquí también: escala, contraste, animaciones.</p>
        </div>
        <BotonAjustes />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Chip">
          <div className="flex flex-wrap gap-2">
            {(['neutral', 'accent', 'accent2', 'moss', 'danger', 'quest'] as const).map((t) => (
              <Chip key={t} tono={t}>
                {t}
              </Chip>
            ))}
            <Chip tono="accent" mono>
              +40 XP
            </Chip>
          </div>
        </Seccion>

        <Seccion titulo="ProgressBar (barra fantasma al bajar)">
          <ProgressBar pct={pct} color="bg-moss-500" etiqueta="Ejemplo" />
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => setPct((p) => Math.max(0, p - 25))} className="tactile rounded border border-iron-700 px-2 py-0.5 text-wood-300">
              −25
            </button>
            <button type="button" onClick={() => setPct(100)} className="tactile rounded border border-iron-700 px-2 py-0.5 text-wood-300">
              Llenar
            </button>
            <span className="text-wood-500">{pct} %</span>
          </div>
          <ProgressBar pct={0} color="bg-danger-500" etiqueta="Vacía" alto="fino" />
        </Seccion>

        <Seccion titulo="Tabs">
          <Tabs etiqueta="Ejemplo" activa={pestana} onChange={setPestana} pestanas={[{ id: 'a', label: 'Inventario', icono: '🎒' }, { id: 'b', label: 'Equipo' }, { id: 'c', label: 'Oficios' }]} />
          <p className="text-2xs text-wood-500">Activa: {pestana} (flechas, Inicio y Fin con el foco en las pestañas).</p>
        </Seccion>

        <Seccion titulo="EntityRow + QuantityStepper">
          <EntityRow
            nombre="Raciones de viaje"
            subtitulo="+20 energía · llevas 5"
            icono="🍖"
            seleccionada={cantidad > 0}
            accion={<QuantityStepper value={cantidad} max={5} tope={3} onChange={setCantidad} etiqueta="Raciones de viaje" motivoTope="Ya estarías saciado" />}
          />
          <EntityRow nombre="Sin miniatura" subtitulo="Icono de reserva" icono="❔" />
        </Seccion>

        <Seccion titulo="Estados de modal">
          <CargandoModal texto="Buscando qué hay en la zona..." filas={2} />
          <ErrorCarga mensaje="No se pudo cargar." onReintentar={() => {}} />
          <ErrorCarga mensaje="Sin reintentar." />
          <ExitoModal>Le entregas la daga a Brenn.</ExitoModal>
        </Seccion>

        <Seccion titulo="OfferCard">
          <OfferCard tone="accent2" icon="💬" title="Brenn busca tu atención" subtitle="Puedes hablar con esta persona." actions={[{ label: 'Interactuar', tone: 'primary', onClick: () => {} }, { label: 'Ignorar', tone: 'neutral', onClick: () => {} }]} />
          <OfferCard tone="danger" icon="⚔️" title="Bloqueada" bloqueo="El narrador todavía está escribiendo." actions={[{ label: 'Combatir', tone: 'danger', onClick: () => {} }]} />
          <OfferCard tone="quest" icon="🎯" title="Resuelta" resolvedText="Resuelto." actions={[]} />
        </Seccion>

        <Seccion titulo="BotonMantener (1 s)">
          <div className="flex gap-2">
            <BotonMantener onConfirmar={() => setMantenido((n) => n + 1)}>Mantén para confirmar</BotonMantener>
            <BotonMantener onConfirmar={() => {}} disabled>
              Deshabilitado
            </BotonMantener>
          </div>
          <p className="text-2xs text-wood-500">Confirmado {mantenido} veces.</p>
        </Seccion>

        <Seccion titulo="ModalShell (tamaños)">
          <div className="flex flex-wrap gap-2">
            {(['sm', 'md', 'lg', 'xl', 'ceremonia'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setModal(t)} className="tactile rounded border border-iron-700 px-2.5 py-1 text-xs text-wood-300">
                {t}
              </button>
            ))}
          </div>
        </Seccion>
      </div>

      <Notificaciones
        notificaciones={[
          { id: 1, tipo: 'quest', icono: '🎯', texto: 'Misión aceptada: El eco', veces: 1 },
          { id: 2, tipo: 'moss', icono: '🎒', texto: 'Obtienes Piedra', veces: 3 },
          { id: 3, tipo: 'danger', icono: '⚠️', texto: 'Reputación con Serhu -5', veces: 1 },
        ]}
        onDescartar={() => {}}
      />

      {modal && (
        <ModalShell
          title={`Modal ${modal}`}
          subtitle="Subtítulo de ejemplo"
          icon="🧪"
          tamano={modal}
          onClose={() => setModal(null)}
          footer={
            <button type="button" onClick={() => setModal(null)} className="tactile flex-1 rounded-lg border border-accent-600 px-3 py-2 text-xs text-accent-200">
              Cerrar
            </button>
          }
        >
          <p className="text-sm text-wood-300">Contenido del cuerpo; el pie queda fijo aunque haya scroll.</p>
        </ModalShell>
      )}
    </div>
  )
}
