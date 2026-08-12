/**
 * 对浏览器 Storage 的容错包装。
 *
 * Storage 属性访问、读写和 JSON 编解码都可能因隐私模式、配额、禁用 Cookie、
 * SSR 或损坏数据而失败。业务代码只通过这里访问，避免存储异常中断主流程。
 */
export function createSafeStorage(storageProvider) {
  const resolveStorage = () => {
    try {
      return storageProvider?.() || null
    } catch {
      return null
    }
  }

  const getItem = (key, fallback = null) => {
    try {
      return resolveStorage()?.getItem(key) ?? fallback
    } catch {
      return fallback
    }
  }

  const setItem = (key, value) => {
    try {
      const storage = resolveStorage()
      if (!storage) return false
      storage.setItem(key, String(value))
      return true
    } catch {
      return false
    }
  }

  const removeItem = (key) => {
    try {
      const storage = resolveStorage()
      if (!storage) return false
      storage.removeItem(key)
      return true
    } catch {
      return false
    }
  }

  const getJSON = (key, fallback, validate = () => true) => {
    const raw = getItem(key)
    if (raw == null) return fallback

    try {
      const parsed = JSON.parse(raw)
      return validate(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }

  const setJSON = (key, value) => {
    try {
      return setItem(key, JSON.stringify(value))
    } catch {
      return false
    }
  }

  return { getItem, setItem, removeItem, getJSON, setJSON }
}

const getWindowStorage = (storageName) => () => {
  if (typeof window === 'undefined') return null
  return window[storageName]
}

export const safeLocalStorage = createSafeStorage(getWindowStorage('localStorage'))
export const safeSessionStorage = createSafeStorage(getWindowStorage('sessionStorage'))
