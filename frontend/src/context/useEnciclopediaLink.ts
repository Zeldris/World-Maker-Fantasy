import { useContext } from 'react'
import { EnciclopediaLinkContext, type EnciclopediaLinkValue } from './enciclopediaLinkContext'

export function useEnciclopediaLink(): EnciclopediaLinkValue {
  return useContext(EnciclopediaLinkContext)
}
