import { useContext } from 'react'
import { AjustesContext, type AjustesValue } from './ajustesContext'

export function useAjustes(): AjustesValue {
  return useContext(AjustesContext)
}
