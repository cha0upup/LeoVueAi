import { onMounted, ref } from 'vue'

import { showError, showSuccess } from '@/utils/messageUtils.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'
import { isCurrentSession, registerSessionCleanup, sessionGeneration } from '@/services/sessionLifecycle.js'
import {
  getAgentTabPath,
  LOAD_DELAYS,
  MAIN_HOME_TAB_ID,
  MAIN_TAB_STORAGE_KEYS,
  ROUTE_PATHS
} from '@/constants/app.js'

const currentTab = ref(MAIN_HOME_TAB_ID)
const tabs = ref([])
let tabsRestored = false
const loadTimers = new Set()

const unregister = registerSessionCleanup('main-tabs', () => {
  for (const timer of loadTimers) window.clearTimeout(timer)
  loadTimers.clear()
  tabs.value = []
  currentTab.value = MAIN_HOME_TAB_ID
  tabsRestored = false
  safeLocalStorage.removeItem(MAIN_TAB_STORAGE_KEYS.tabs)
  safeLocalStorage.removeItem(MAIN_TAB_STORAGE_KEYS.currentTab)
})
if (import.meta.hot) import.meta.hot.dispose(unregister)

const createTabKey = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function useMainTabs({ confirmAction, iconMap }) {
  const saveTabsToStorage = () => {
    const tabsToSave = tabs.value.map(
      ({
        cacheMode,
        capabilities,
        connLink,
        id,
        initialPrompt,
        isLoaded,
        projectId,
        projectName,
        sessionId,
        tabKey,
        title
      }) => ({
        cacheMode,
        capabilities,
        connLink,
        id,
        initialPrompt,
        isLoaded,
        projectId,
        projectName,
        sessionId,
        tabKey,
        title
      })
    )

    safeLocalStorage.setJSON(MAIN_TAB_STORAGE_KEYS.tabs, tabsToSave)
    safeLocalStorage.setItem(MAIN_TAB_STORAGE_KEYS.currentTab, currentTab.value)
  }

  const markTabAsLoaded = (tabId) => {
    const currentTabItem = tabs.value.find((tab) => tab.id === tabId)
    if (!currentTabItem) {
      return
    }

    currentTabItem.isLoaded = true
    saveTabsToStorage()
  }

  const loadAgentConsoleTab = (tab) => {
    if (tab.isLoaded) {
      return
    }

    const requestGeneration = sessionGeneration.value
    const timer = window.setTimeout(() => {
      loadTimers.delete(timer)
      if (isCurrentSession(requestGeneration)) markTabAsLoaded(tab.id)
    }, LOAD_DELAYS.tabContent)
    loadTimers.add(timer)
  }

  const restoreTabsFromStorage = () => {
    if (tabsRestored) return
    tabsRestored = true

    const savedTabs = safeLocalStorage
      .getJSON(MAIN_TAB_STORAGE_KEYS.tabs, [], Array.isArray)
      .filter((tab) => typeof tab?.tabKey === 'string' && tab.tabKey &&
        tab.id === 'agent-tab-' + tab.tabKey)
    const savedCurrentTab = safeLocalStorage.getItem(MAIN_TAB_STORAGE_KEYS.currentTab)

    tabs.value = savedTabs.map((tab) => ({ ...tab, icon: iconMap.server }))

    if (savedCurrentTab && tabs.value.some((tab) => tab.id === savedCurrentTab)) {
      currentTab.value = savedCurrentTab
    } else {
      currentTab.value = MAIN_HOME_TAB_ID
    }

    tabs.value.forEach((tab) => {
      if (tab.sessionId && !tab.isLoaded && currentTab.value === tab.id) {
        loadAgentConsoleTab(tab)
      }
    })

    saveTabsToStorage()
  }

  const switchTab = (tabId) => {
    restoreTabsFromStorage()
    const tab = tabs.value.find((item) => item.id === tabId)
    if (!tab) {
      return null
    }

    currentTab.value = tabId
    saveTabsToStorage()

    if (tab?.sessionId && !tab.isLoaded) {
      loadAgentConsoleTab(tab)
    }

    return tab
  }

  const switchTabByKey = (tabKey) => {
    restoreTabsFromStorage()
    const tab = tabs.value.find((item) => item.tabKey === tabKey)
    if (!tab) {
      return null
    }
    return switchTab(tab.id)
  }

  const goToHome = () => {
    restoreTabsFromStorage()
    currentTab.value = MAIN_HOME_TAB_ID
    saveTabsToStorage()
  }

  const getTabRoute = (tab) => {
    return tab?.tabKey ? getAgentTabPath(tab.tabKey) : ROUTE_PATHS.main
  }

  const closeTab = async (tabId, index) => {
    const requestGeneration = sessionGeneration.value
    const confirmed = await confirmAction({
      title: '确认关闭',
      message: '确定要关闭这个主机连接吗？',
      type: 'warning'
    })

    if (!confirmed || !isCurrentSession(requestGeneration)) {
      return { closed: false, nextTab: null }
    }

    try {
      const closedIndex = tabs.value.findIndex((tab) => tab.id === tabId)
      const nextTabs = tabs.value.filter((tab) => tab.id !== tabId)
      let nextTab = null

      if (currentTab.value === tabId) {
        const nextIndex = index > 0 ? index - 1 : Math.max(closedIndex, 0)
        nextTab = nextTabs[nextIndex] || nextTabs[0] || null
        currentTab.value = nextTab?.id || MAIN_HOME_TAB_ID
      }

      tabs.value = nextTabs
      saveTabsToStorage()
      showSuccess('主机连接已关闭')
      return { closed: true, nextTab }
    } catch {
      showError('关闭失败')
      return { closed: false, nextTab: null }
    }
  }

  const addAgentConsoleTab = (agentConsoleParams) => {
    restoreTabsFromStorage()
    const existingTab = tabs.value.find((tab) => tab.sessionId === agentConsoleParams.sessionId)
    if (existingTab) {
      existingTab.initialPrompt =
        agentConsoleParams.initialPrompt || existingTab.initialPrompt || ''
      existingTab.projectId = agentConsoleParams.projectId || existingTab.projectId || ''
      existingTab.projectName = agentConsoleParams.projectName || existingTab.projectName || ''
      existingTab.capabilities = Array.isArray(agentConsoleParams.capabilities)
        ? agentConsoleParams.capabilities
        : existingTab.capabilities || []
      currentTab.value = existingTab.id
      saveTabsToStorage()
      if (existingTab.sessionId && !existingTab.isLoaded) {
        loadAgentConsoleTab(existingTab)
      }
      return existingTab
    }

    const tabKey = createTabKey()
    const newTab = {
      id: `agent-tab-${tabKey}`,
      tabKey,
      title: agentConsoleParams.agentName,
      icon: iconMap.server,
      sessionId: agentConsoleParams.sessionId,
      connLink: agentConsoleParams.connLink,
      projectId: agentConsoleParams.projectId || '',
      projectName: agentConsoleParams.projectName || '',
      cacheMode: agentConsoleParams.cacheMode || false,
      capabilities: Array.isArray(agentConsoleParams.capabilities)
        ? agentConsoleParams.capabilities
        : [],
      initialPrompt: agentConsoleParams.initialPrompt || '',
      isLoaded: false
    }

    tabs.value.push(newTab)
    currentTab.value = newTab.id
    saveTabsToStorage()
    loadAgentConsoleTab(newTab)
    return newTab
  }

  onMounted(() => {
    restoreTabsFromStorage()
  })

  return {
    HOME_TAB_ID: MAIN_HOME_TAB_ID,
    currentTab,
    tabs,
    addAgentConsoleTab,
    closeTab,
    getTabRoute,
    goToHome,
    switchTab,
    switchTabByKey
  }
}
