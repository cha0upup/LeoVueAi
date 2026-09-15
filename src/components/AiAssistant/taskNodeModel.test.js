import { describe, expect, it } from 'vitest'
import {
  formatToolValue,
  getShellResultId,
  getThinkingPeek,
  getToolStatusLabel,
  getToolTone
} from './taskNodeModel.js'

describe('taskNodeModel', () => {
  it('extracts a thinking preview and preserves failed tool state', () => {
    expect(getThinkingPeek('第一句。第二句')).toBe('第一句')
    expect(getToolTone({ status: 'done', success: false })).toBe('danger')
    expect(getToolStatusLabel({ status: 'done', success: false })).toBe('失败')
  })

  it('formats cyclic, JSON and oversized values defensively', () => {
    expect(formatToolValue('{"ok":true}')).toBe('{\n  "ok": true\n}')
    expect(formatToolValue('abcdef', 3)).toBe('abc\n…（已截断）')
    const cyclic = {}
    cyclic.self = cyclic
    expect(formatToolValue(cyclic)).toBe('[object Object]')
  })

  it('extracts nested shell result identifiers', () => {
    expect(getShellResultId('{"data":{"resultId":" result-1 "}}')).toBe('result-1')
    expect(getShellResultId('plain output')).toBeNull()
  })
})
