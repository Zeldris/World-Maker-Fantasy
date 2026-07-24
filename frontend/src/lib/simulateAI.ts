import type { LogEntry } from '../types'

let counter = 0
function nextId(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}`
}

export function playerActionEntry(action: string, timeLabel: string): LogEntry {
  return {
    id: nextId('p'),
    channel: 'character',
    text: action,
    timeLabel,
    isPlayerAction: true,
    createdAt: new Date().toISOString(),
  }
}
