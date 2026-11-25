import { describe, expect, it } from 'vitest'
import {
  formatToolValue,
  getShellResultId,
  getTaskOutputRef,
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

  it('formats JSON and truncates oversized string values', () => {
    expect(formatToolValue('{"ok":true}')).toBe('{\n  "ok": true\n}')
    expect(formatToolValue('abcdef', 3)).toBe('abc\n…（已截断）')
    expect(formatToolValue({ ok: true })).toBe('')
  })

  it('extracts shell result identifiers', () => {
    expect(getShellResultId('{"resultId":" result-1 "}')).toBe('result-1')
    expect(getShellResultId('plain output')).toBeNull()
    expect(getShellResultId({ resultId: 'old-shape' })).toBeNull()
  })

  it('shows download references only for task output files', () => {
    expect(getTaskOutputRef('{"userWorkspacePath":" ai-tasks/job/files/reports/note.txt ","size":12}')).toEqual({
      path: 'ai-tasks/job/files/reports/note.txt',
      filename: 'note.txt'
    })
    expect(getTaskOutputRef('{"userWorkspacePath":"imports/old.txt"}')).toBeNull()
    expect(getTaskOutputRef('{"userWorkspacePath":"ai-tasks/job/.internal/metadata.json"}')).toBeNull()
    expect(getTaskOutputRef('{"userWorkspacePath":"ai-tasks/job/files/"}')).toBeNull()
  })
})
