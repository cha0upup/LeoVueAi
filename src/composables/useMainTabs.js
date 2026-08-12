import { onMounted, ref } from 'vue'

import { showError, showSuccess } from '@/utils/messageUtils.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'
import {
  getPuppetTabPath,
  LOAD_DELAYS,
  MAIN_HOME_TAB_ID,
  MAIN_TAB_STORAGE_KEYS,
  ROUTE_PATHS
} from '@/constants/app.js'

const currentTab = ref(MAIN_HOME_TAB_ID)
const tabs = ref([])
let tabsRestored = false

const createTabKey = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const ensureTabShape = (tab) => {
  const tabKey = tab.tabKey || createTabKey()
  const rawId = String(tab.id || '')
  const shouldRefreshId =
    !rawId || (rawId.startsWith('puppet-') && !rawId.startsWith('puppet-tab-'))
  return {
    ...tab,
    id: shouldRefreshId ? `puppet-tab-${tabKey}` : tab.id,
    tabKey
  }
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

  const loadPuppetEntity = (tab) => {
    if (tab.isLoaded) {
      return
    }

    window.setTimeout(() => {
      markTabAsLoaded(tab.id)
    }, LOAD_DELAYS.tabContent)
  }

  const restoreTabsFromStorage = () => {
    if (tabsRestored) return
    tabsRestored = true

    const savedTabs = safeLocalStorage
      .getJSON(MAIN_TAB_STORAGE_KEYS.tabs, [], Array.isArray)
      .filter((tab) => tab && typeof tab === 'object')
    const savedCurrentTab = safeLocalStorage.getItem(MAIN_TAB_STORAGE_KEYS.currentTab)

    tabs.value = savedTabs.map((tab) => ({
      ...ensureTabShape(tab),
      icon: iconMap.server
    }))

    if (savedCurrentTab && tabs.value.some((tab) => tab.id === savedCurrentTab)) {
      currentTab.value = savedCurrentTab
    } else {
      currentTab.value = MAIN_HOME_TAB_ID
    }

    tabs.value.forEach((tab) => {
      if (tab.sessionId && !tab.isLoaded && currentTab.value === tab.id) {
        loadPuppetEntity(tab)
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
      loadPuppetEntity(tab)
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
    return tab?.tabKey ? getPuppetTabPath(tab.tabKey) : ROUTE_PATHS.main
  }

  const closeTab = async (tabId, index) => {
    const confirmed = await confirmAction({
      title: '确认关闭',
      message: '确定要关闭这个主机连接吗？',
      type: 'warning'
    })

    if (!confirmed) {
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

  const addPuppetEntity = (puppetEntityParams) => {
    restoreTabsFromStorage()
    const existingTab = tabs.value.find((tab) => tab.sessionId === puppetEntityParams.sessionId)
    if (existingTab) {
      existingTab.initialPrompt =
        puppetEntityParams.initialPrompt || existingTab.initialPrompt || ''
      existingTab.projectId = puppetEntityParams.projectId || existingTab.projectId || ''
      existingTab.projectName = puppetEntityParams.projectName || existingTab.projectName || ''
      existingTab.capabilities = Array.isArray(puppetEntityParams.capabilities)
        ? puppetEntityParams.capabilities
        : existingTab.capabilities || []
      currentTab.value = existingTab.id
      saveTabsToStorage()
      if (existingTab.sessionId && !existingTab.isLoaded) {
        loadPuppetEntity(existingTab)
      }
      return existingTab
    }

    const tabKey = createTabKey()
    const newTab = {
      id: `puppet-tab-${tabKey}`,
      tabKey,
      title: puppetEntityParams.puppetName,
      icon: iconMap.server,
      sessionId: puppetEntityParams.sessionId,
      connLink: puppetEntityParams.connLink,
      projectId: puppetEntityParams.projectId || '',
      projectName: puppetEntityParams.projectName || '',
      cacheMode: puppetEntityParams.cacheMode || false,
      capabilities: Array.isArray(puppetEntityParams.capabilities)
        ? puppetEntityParams.capabilities
        : [],
      initialPrompt: puppetEntityParams.initialPrompt || '',
      isLoaded: false
    }

    tabs.value.push(newTab)
    currentTab.value = newTab.id
    saveTabsToStorage()
    loadPuppetEntity(newTab)
    return newTab
  }

  onMounted(() => {
    restoreTabsFromStorage()
  })

  return {
    HOME_TAB_ID: MAIN_HOME_TAB_ID,
    currentTab,
    tabs,
    addPuppetEntity,
    closeTab,
    getTabRoute,
    goToHome,
    switchTab,
    switchTabByKey
  }
}
