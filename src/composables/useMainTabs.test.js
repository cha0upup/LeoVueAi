import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { MAIN_TAB_STORAGE_KEYS } from '@/constants/app.js'
import { resetSessionState } from '@/services/sessionLifecycle.js'
import { useMainTabs } from './useMainTabs.js'

vi.mock('vue', async importOriginal => ({ ...await importOriginal(), onMounted: () => {} }))

const storage = new Map()
const workspace = confirmAction => useMainTabs({ confirmAction, iconMap: { server: 'server' } })

describe('main workspace login scope', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {
      setTimeout, clearTimeout,
      crypto: { randomUUID: () => String(Math.random()) },
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key)
      }
    })
    resetSessionState()
    storage.clear()
  })

  afterEach(() => {
    resetSessionState()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('clears both memory and stored tabs and cancels delayed writes', () => {
    const tabs = workspace(vi.fn())
    tabs.addAgentConsoleTab({ sessionId: 'old-session', agentName: 'old user' })
    expect(tabs.tabs.value).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(1)
    resetSessionState()
    expect(tabs.tabs.value).toEqual([])
    expect(tabs.currentTab.value).toBe(tabs.HOME_TAB_ID)
    expect(vi.getTimerCount()).toBe(0)
    vi.runAllTimers()
    expect(storage.has(MAIN_TAB_STORAGE_KEYS.tabs)).toBe(false)
    expect(storage.has(MAIN_TAB_STORAGE_KEYS.currentTab)).toBe(false)
  })

  it('restores fresh storage after resetting the one-time restoration flag', () => {
    const tabs = workspace(vi.fn())
    tabs.goToHome()
    resetSessionState()
    storage.set(MAIN_TAB_STORAGE_KEYS.tabs, JSON.stringify([
      { id: 'agent-tab-new', tabKey: 'new', sessionId: 'new-session', isLoaded: true }
    ]))
    tabs.goToHome()
    expect(tabs.tabs.value).toHaveLength(1)
    expect(tabs.tabs.value[0].sessionId).toBe('new-session')
  })

  it('ignores an old close confirmation after the account changes', async () => {
    const confirmation = deferred()
    const tabs = workspace(() => confirmation.promise)
    const oldTab = tabs.addAgentConsoleTab({ sessionId: 'old-session' })
    const closing = tabs.closeTab(oldTab.id, 0)
    resetSessionState()
    const newTab = tabs.addAgentConsoleTab({ sessionId: 'new-session' })
    confirmation.resolve(true)
    await expect(closing).resolves.toEqual({ closed: false, nextTab: null })
    expect(tabs.tabs.value.map(tab => tab.id)).toEqual([newTab.id])
  })
})
