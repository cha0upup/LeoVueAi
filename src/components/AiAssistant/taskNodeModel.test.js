import { describe, expect, it } from 'vitest'
import {
  formatToolValue,
  getInitialNodeOpenState,
  getShellResultId,
  getSubtaskPresentation,
  getThinkingPeek,
  getToolKindIcon,
  getToolStatusLabel,
  getToolTone
} from './taskNodeModel.js'

describe('taskNodeModel', () => {
  it('derives stable node presentation states', () => {
    expect(getInitialNodeOpenState('thinking')).toBe(false)
    expect(getInitialNodeOpenState('subtask')).toBe(true)
    expect(getThinkingPeek('第一句。第二句')).toBe('第一句')
    expect(getToolTone({ status: 'done', success: false })).toBe('danger')
    expect(getToolStatusLabel({ status: 'done', success: false })).toBe('失败')
    expect(getSubtaskPresentation('CANCELLED')).toEqual({ tone: 'danger', label: '已停止' })
  })

  it('formats cyclic, JSON and oversized values defensively', () => {
    expect(formatToolValue('{"ok":true}')).toBe('{\n  "ok": true\n}')
    expect(formatToolValue('abcdef', 3)).toBe('abc\n…（已截断）')
    const cyclic = {}
    cyclic.self = cyclic
    expect(formatToolValue(cyclic)).toBe('[object Object]')
  })

  it('recognizes tool icons and nested shell result identifiers', () => {
    expect(getToolKindIcon('sendHttpRequest')).toBe('mdi:web')
    expect(getToolKindIcon('readTextFile')).toBe('mdi:file-outline')
    expect(getShellResultId('{"data":{"resultId":" result-1 "}}')).toBe('result-1')
    expect(getShellResultId('plain output')).toBeNull()
  })
})
