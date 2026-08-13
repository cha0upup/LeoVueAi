import { describe, expect, it } from 'vitest'
import {
  getToolDisplayName,
  groupConsecutiveToolNodes,
  isInternalToolNode,
  summarizeToolNode
} from './aiProcessPresentation.js'

describe('aiProcessPresentation', () => {
  it('maps internal tool names to business labels', () => {
    expect(getToolDisplayName('execSql')).toBe('执行 SQL')
    expect(getToolDisplayName('createDatabaseConnection')).toBe('新增数据库配置')
    expect(getToolDisplayName('updateDatabaseConnection')).toBe('编辑数据库配置')
    expect(getToolDisplayName('deleteDatabaseConnection')).toBe('删除数据库配置')
    expect(getToolDisplayName('manage_recon_summary')).toBe('更新侦察摘要')
    expect(getToolDisplayName('inspectWebRuntime')).toBe('检查 Web Runtime')
    expect(getToolDisplayName('removeWebRuntimeComponent')).toBe('移除 Web Runtime 组件')
    expect(getToolDisplayName('customTool')).toBe('customTool')
  })

  it('identifies the invisible operation assessment protocol tool', () => {
    expect(isInternalToolNode({
      kind: 'tool', name: 'assess_operation', businessTool: false, toolKind: 'CONTROL'
    })).toBe(true)
    expect(isInternalToolNode({
      kind: 'tool', name: 'anything', businessTool: false, toolKind: 'CONTROL'
    })).toBe(true)
    expect(isInternalToolNode({ name: 'assess_operation' })).toBe(false)
    expect(isInternalToolNode({
      kind: 'tool', name: 'exec', businessTool: false, toolKind: 'COMMAND'
    })).toBe(false)
  })

  it('summarizes common tool results', () => {
    expect(summarizeToolNode({ status: 'done', result: '{"rowCount":12}' })).toBe('返回 12 行数据')
    expect(summarizeToolNode({ status: 'done', result: ['a', 'b'] })).toBe('2 项结果')
    expect(summarizeToolNode({ name: 'harvestAll', status: 'done', result: 'password=secret' })).toBe('已返回敏感信息结果')
    expect(summarizeToolNode({ status: 'failed', error: '连接失败' })).toBe('连接失败')
  })

  it('groups only consecutive successful calls with the same name', () => {
    const nodes = [
      { id: '1', kind: 'tool', name: 'execSql', status: 'done', success: true },
      { id: '2', kind: 'tool', name: 'execSql', status: 'done', success: true },
      { id: '3', kind: 'thinking' },
      { id: '4', kind: 'tool', name: 'execSql', status: 'failed', success: false }
    ]
    const result = groupConsecutiveToolNodes(nodes)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ kind: 'tool-group', name: 'execSql' })
    expect(result[0].children).toHaveLength(2)
    expect(result[2].id).toBe('4')
  })
})
