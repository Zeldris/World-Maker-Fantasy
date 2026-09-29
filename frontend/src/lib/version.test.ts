import { describe, it, expect } from 'vitest'
import { formatearVersion } from './version'

describe('formatearVersion', () => {
  it('caso normal: etiqueta con etapa', () => {
    expect(formatearVersion('v0.0.0-alpha-2-g67014de')).toBe('0.0.2-alpha+67014de')
    expect(formatearVersion('v0.1.0-alpha-37-g44f8ba3\n')).toBe('0.1.37-alpha+44f8ba3')
  })

  it('etiqueta sin etapa: no añade -etapa', () => {
    expect(formatearVersion('v1.0.0-5-gabc1234')).toBe('1.0.5+abc1234')
  })

  it('0 commits desde la etiqueta', () => {
    expect(formatearVersion('v0.2.0-beta-0-g1234567')).toBe('0.2.0-beta+1234567')
  })

  it('entrada basura → null', () => {
    expect(formatearVersion('')).toBeNull()
    expect(formatearVersion('hola')).toBeNull()
    expect(formatearVersion('v0.0.0-alpha')).toBeNull()
    expect(formatearVersion('fatal: No names found')).toBeNull()
  })
})
