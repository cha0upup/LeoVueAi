import { describe, expect, it } from 'vitest'
import { getAgentTabPath, HOME_MENU_GROUPS, ROUTE_NAMES, ROUTE_PATHS } from './app.js'
import { buildAgentTransferBundle, parseAgentTransferPayload } from '../utils/agentTransfer.js'

describe('agent naming contract', () => {
  it('names the script builder by its role instead of treating it as a host', () => {
    const group = HOME_MENU_GROUPS.find(item => item.key === 'generate')
    expect(group.items.find(item => item.title === '脚本构建').key).toBe('script-generator')
  })
  it('uses agent routes while preserving opaque tab identities', () => {
    expect(ROUTE_NAMES.mainAgent).toBe('MainAgent')
    expect(ROUTE_PATHS.mainAgent).toBe('/main/agent/:tabKey')
    expect(getAgentTabPath('node/1')).toBe('/main/agent/node%2F1')
  })

  it('exports the new format and preserves host configuration values', () => {
    const bundle = buildAgentTransferBundle([
      { agentId: 'node-1', agentName: '主机 A', parentAgentId: 'root', type: 'php' }
    ], ['node-1'])
    expect(bundle.format).toBe('leo-agent-bundle')
    expect(bundle.agents[0].config).toEqual({ agentName: '主机 A', type: 'php' })
    expect(bundle).not.toHaveProperty('puppets')
    expect(parseAgentTransferPayload(bundle).targetIds).toEqual(new Set(['node-1']))
  })

  it('keeps old transfer formats at the offline migration boundary', () => {
    expect(() => parseAgentTransferPayload({
      format: 'leo-puppet-bundle', version: 2, puppets: [], roots: ['node-1']
    })).toThrow('配置内容不是有效的主机配置包')
  })
})
