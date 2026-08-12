import { computed, ref, watch } from 'vue'
import { safeSessionStorage } from '@/utils/browserStorage.js'

const MAX_TABS = 6

/**
 * LRU tab management for PuppetConsole workspace.
 * AI is a separate dock — not a tab. Default first tab is 'info'.
 *
 * @param {Array} moduleDefinitions - from usePuppetConsoleModules
 * @param {Object} [options]
 * @param {() => string} [options.getSessionId] - returns current session ID for storage scoping
 * @param {(key: string, module: Object) => boolean} [options.isModuleAvailable]
 */
export function useToolTabs(moduleDefinitions, { getSessionId = () => '', isModuleAvailable = () => true } = {}) {
  const moduleMap = Object.fromEntries(moduleDefinitions.map((m) => [m.key, m]))

  const DEFAULT_TABS = ['info', 'file', 'terminal']

  function _isAvailableKey(key) {
    const module = moduleMap[key]
    return !!module && isModuleAvailable(key, module)
  }

  function _initialTabKeys() {
    const defaults = DEFAULT_TABS.filter(_isAvailableKey)
    if (defaults.length) return defaults
    const first = moduleDefinitions.find((m) => m.key !== 'ai' && _isAvailableKey(m.key))
    return first ? [first.key] : []
  }

  const tabKeys = ref(_initialTabKeys())
  const activeKey = ref(tabKeys.value[0] || '')
  // LRU access order (least-recently-used at index 0)
  const accessOrder = ref([...tabKeys.value])

  // ── Storage helpers ───────────────────────────────────────────────────────
  const _storageKey = () => {
    const sid = getSessionId()
    return sid ? `puppet-tabs-${sid}` : null
  }

  const _loadFromStorage = () => {
    const key = _storageKey()
    if (!key) return
    const savedState = safeSessionStorage.getJSON(
      key,
      null,
      (value) => value && typeof value === 'object' && Array.isArray(value.tabs)
    )
    if (!savedState) return

    const { tabs: saved, active } = savedState
    const valid = saved.filter((tabKey) => tabKey !== 'ai' && _isAvailableKey(tabKey))
    if (!valid.length) {
      resetTabs()
      return
    }
    tabKeys.value = valid.slice(0, MAX_TABS)
    accessOrder.value = [...tabKeys.value]
    activeKey.value = tabKeys.value.includes(active) ? active : tabKeys.value[tabKeys.value.length - 1]
  }

  const _saveToStorage = () => {
    const key = _storageKey()
    if (!key) return
    safeSessionStorage.setJSON(key, { tabs: tabKeys.value, active: activeKey.value })
  }

  // Persist on every change
  watch([tabKeys, activeKey], _saveToStorage, { deep: true })

  // Load persisted tabs for the current session.
  // Call explicitly from onMounted and on session switch — not at composable init time
  // because getSessionId() may not have a valid value yet during setup().
  function loadForSession() {
    _loadFromStorage()
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const tabs = computed(() => tabKeys.value.map((k) => moduleMap[k]).filter((m) => m && _isAvailableKey(m.key)))

  const activeTab = computed(() => moduleMap[activeKey.value] || null)

  // ── Internal helpers ──────────────────────────────────────────────────────
  function _touchLRU(key) {
    accessOrder.value = [...accessOrder.value.filter((k) => k !== key), key]
  }

  function _evictLRU() {
    const candidate = accessOrder.value[0]
    if (candidate) closeTab(candidate)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Open a tool tab. No-op for 'ai' (lives in dock). */
  function openTab(key) {
    if (key === 'ai' || !_isAvailableKey(key)) return

    if (tabKeys.value.includes(key)) {
      setActive(key)
      return
    }

    if (tabKeys.value.length >= MAX_TABS) {
      _evictLRU()
    }

    tabKeys.value = [...tabKeys.value, key]
    setActive(key)
  }

  /** Ensure a tab is in the list WITHOUT activating it (for background notifications). */
  function ensureTab(key) {
    if (key === 'ai' || !_isAvailableKey(key)) return
    if (tabKeys.value.includes(key)) return
    if (tabKeys.value.length >= MAX_TABS) {
      _evictLRU()
    }
    tabKeys.value = [...tabKeys.value, key]
  }

  /** Close a tab. If it's the last tab, keep it. */
  function closeTab(key) {
    if (key === 'ai') return
    if (tabKeys.value.length <= 1) return   // keep at least one tab open
    const idx = tabKeys.value.indexOf(key)
    if (idx === -1) return

    tabKeys.value = tabKeys.value.filter((k) => k !== key)
    accessOrder.value = accessOrder.value.filter((k) => k !== key)

    if (activeKey.value === key) {
      const newActive = tabKeys.value[Math.min(idx, tabKeys.value.length - 1)]
      activeKey.value = newActive || tabKeys.value[0]
    }
  }

  /** Activate an open tab */
  function setActive(key) {
    if (!tabKeys.value.includes(key) || !_isAvailableKey(key)) return
    activeKey.value = key
    _touchLRU(key)
  }

  /** Returns true if the given key is currently open */
  function isOpen(key) {
    return tabKeys.value.includes(key)
  }

  /** Reset to initial in-memory state — call on session switch before loadForSession().
   *  Does NOT clear storage; the old session's entry stays until the browser tab closes,
   *  and the new session's entry will be written by the watch on next change. */
  function resetTabs() {
    tabKeys.value = _initialTabKeys()
    activeKey.value = tabKeys.value[0] || ''
    accessOrder.value = [...tabKeys.value]
  }

  watch(
    tabs,
    (availableTabs) => {
      if (availableTabs.some((tab) => tab.key === activeKey.value)) return
      const fallback = availableTabs[0]?.key
      if (fallback) {
        activeKey.value = fallback
        _touchLRU(fallback)
        return
      }
      if (tabKeys.value.length || activeKey.value) {
        resetTabs()
      }
    },
    { immediate: true }
  )

  return {
    tabs,
    tabKeys,
    activeKey,
    activeTab,
    openTab,
    ensureTab,
    closeTab,
    setActive,
    isOpen,
    resetTabs,
    loadForSession,
    MAX_TABS
  }
}
