import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useToolTabs } from './useToolTabs.js'

describe('tool tab LRU', () => {
  let scope
  beforeEach(() => {
    scope = effectScope()
    vi.stubGlobal('window', { sessionStorage: { getItem: () => null, setItem: vi.fn() } })
  })
  afterEach(() => {
    scope.stop()
    vi.unstubAllGlobals()
  })

  it('includes background-only tabs in the eviction order and preserves the limit', () => {
    const definitions = ['info', 'file', 'terminal', ...Array.from({ length: 10 }, (_, i) => `tool-${i}`)]
      .map(key => ({ key }))
    const tabs = scope.run(() => useToolTabs(definitions))
    for (const { key } of definitions.slice(3)) {
      tabs.ensureTab(key)
      expect(tabs.tabKeys.value.length).toBeLessThanOrEqual(tabs.MAX_TABS)
    }
    expect(tabs.tabKeys.value).toContain('tool-9')
    expect(tabs.tabKeys.value).not.toContain('tool-0')
  })

  it('evicts the least recently visited tab while keeping a recently reactivated tab', () => {
    const definitions = ['info', 'file', 'terminal', 'scan', 'database', 'plugin', 'resource'].map(key => ({ key }))
    const tabs = scope.run(() => useToolTabs(definitions))
    for (const key of ['scan', 'database', 'plugin']) tabs.openTab(key)
    tabs.setActive('info')
    tabs.openTab('resource')
    expect(tabs.tabKeys.value).toHaveLength(6)
    expect(tabs.tabKeys.value).toContain('info')
    expect(tabs.tabKeys.value).not.toContain('file')
  })
})
