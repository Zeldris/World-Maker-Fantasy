import { createContext } from 'react'
import { EMPTY_ENCICLOPEDIA_INDEX, type EnciclopediaIndex, type EnciclopediaLinkTarget } from '../lib/enciclopediaIndex'

export interface EnciclopediaLinkValue {
  enciclopediaIndex: EnciclopediaIndex
  onEntityDetail?: (target: EnciclopediaLinkTarget) => void
  onEntityQuickInsert?: (target: EnciclopediaLinkTarget) => void
}

export const EnciclopediaLinkContext = createContext<EnciclopediaLinkValue>({ enciclopediaIndex: EMPTY_ENCICLOPEDIA_INDEX })
