import { ref } from 'vue'
import { THEME_STORAGE_KEY } from '@/constants/app.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const themes = {
  light: {
    name: 'IDEA 明亮',
    value: 'light',
    '--el-color-primary': '#1677ff',
    '--el-color-primary-light-3': '#3a8dff',
    '--el-color-primary-light-5': '#62a6ff',
    '--el-color-primary-light-7': '#93c0ff',
    '--el-color-primary-light-8': '#c7deff',
    '--el-color-primary-light-9': '#e8f2ff',
    '--el-color-primary-dark-2': '#0f5fc4',
    '--el-color-success': '#3f9a57',
    '--el-color-warning': '#c27a1f',
    '--el-color-danger': '#cf4e57',
    '--el-color-info': '#4f7fe8',
    '--el-color-white': '#ffffff',
    '--el-color-black': '#000000',
    '--el-bg-color': '#ffffff',
    '--el-bg-color-page': '#f5f7fa',
    '--el-bg-color-overlay': '#ffffff',
    '--el-text-color-primary': '#1d2129',
    '--el-text-color-regular': '#4e5969',
    '--el-text-color-secondary': '#6b7785',
    '--el-text-color-placeholder': '#86909c',
    '--el-text-color-disabled': '#bcc1c8',
    '--el-border-color': '#dde1e7',
    '--el-border-color-light': '#e5e6eb',
    '--el-border-color-lighter': '#ebecef',
    '--el-border-color-extra-light': '#f2f3f5',
    '--el-box-shadow': '0 18px 36px -26px rgba(31, 35, 41, 0.18)',
    '--el-box-shadow-light': '0 12px 24px -20px rgba(31, 35, 41, 0.1)',
    '--el-box-shadow-lighter': '0 8px 14px -12px rgba(31, 35, 41, 0.06)',
    '--el-box-shadow-dark': '0 28px 52px -28px rgba(31, 35, 41, 0.18)',
    '--app-frame-background': '#f5f7fa',
    '--app-surface-background': '#ffffff',
    '--app-surface-background-soft': '#f7f8fa',
    '--app-surface-background-muted': '#f2f3f5',
    '--app-surface-level-1': '#ffffff',
    '--app-surface-level-2': '#f7f8fa',
    '--app-card-background': '#ffffff',
    '--app-card-active-background': 'rgba(238, 239, 240, 0.96)',
    '--app-control-background': 'rgba(247, 247, 247, 0.96)',
    '--app-control-background-soft': 'rgba(243, 243, 243, 0.98)',
    '--app-control-background-hover': 'rgba(236, 236, 236, 0.98)',
    '--app-brand-background': 'rgba(22, 119, 255, 0.16)',
    '--app-soft-glow': 'rgba(22, 119, 255, 0.12)',
    '--app-secondary-glow': 'rgba(118, 141, 167, 0.05)',
    '--app-shell-shadow': '0 16px 34px rgba(23, 32, 51, 0.05)',
    '--app-shell-shadow-strong': '0 22px 42px rgba(23, 32, 51, 0.07)',
    '--app-shell-shadow-soft': '0 10px 20px rgba(23, 32, 51, 0.04)',
    '--app-card-shadow-hover': '0 14px 28px rgba(23, 32, 51, 0.06)',
    '--app-card-shadow-active': '0 16px 32px rgba(22, 119, 255, 0.2)',
    '--app-dialog-background': '#fbfbfa',
    '--app-dialog-intro-background': 'rgba(22, 119, 255, 0.1)',
    '--app-dialog-warning-background': 'rgba(173, 140, 102, 0.1)',
    '--app-dialog-subtle-background': 'rgba(245, 245, 245, 0.92)',
    '--app-code-background': '#1e1f22',
    '--app-code-background-soft': '#2b2d30',
    '--app-code-text': '#f3f4f6',
    '--app-code-text-muted': '#c8ccd4',
    '--app-code-border': 'rgba(255, 255, 255, 0.08)',
    '--app-code-scroll-track': '#2b2d30',
    '--app-code-scroll-thumb': '#5f6368',
    '--app-code-scroll-thumb-hover': '#7b8087',
    '--app-primary-soft-surface': '#3a8dff',
    '--app-primary-strong-surface': '#1677ff',
    '--app-primary-shadow': '0 12px 24px rgba(22, 119, 255, 0.26)',
    '--app-inset-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
    '--app-inset-highlight-soft': 'inset 0 1px 0 rgba(255, 255, 255, 0.56)'
  },
  dark: {
    name: 'IDEA 黑暗',
    value: 'dark',
    '--el-color-primary': '#2f8cff',
    '--el-color-primary-light-3': '#55a1ff',
    '--el-color-primary-light-5': '#7db6ff',
    '--el-color-primary-light-7': '#a9ccff',
    '--el-color-primary-light-8': '#d3e5ff',
    '--el-color-primary-light-9': '#eff7ff',
    '--el-color-primary-dark-2': '#1f66d6',
    '--el-color-success': '#59c277',
    '--el-color-warning': '#f0ad4e',
    '--el-color-danger': '#f07178',
    '--el-color-info': '#79a8ff',
    '--el-color-white': '#ffffff',
    '--el-color-black': '#000000',
    '--el-bg-color': '#141820',
    '--el-bg-color-page': '#0f131a',
    '--el-bg-color-overlay': '#171c25',
    '--el-text-color-primary': '#dfe1e5',
    '--el-text-color-regular': '#c8ccd4',
    '--el-text-color-secondary': '#9da3ad',
    '--el-text-color-placeholder': '#7c828d',
    '--el-text-color-disabled': '#5a6068',
    '--el-border-color': '#2c3440',
    '--el-border-color-light': '#333c49',
    '--el-border-color-lighter': '#394351',
    '--el-border-color-extra-light': '#454e5d',
    '--el-box-shadow': '0 22px 46px -28px rgba(0, 0, 0, 0.44)',
    '--el-box-shadow-light': '0 14px 28px -20px rgba(0, 0, 0, 0.3)',
    '--el-box-shadow-lighter': '0 10px 18px -14px rgba(0, 0, 0, 0.24)',
    '--el-box-shadow-dark': '0 32px 60px -30px rgba(0, 0, 0, 0.48)',
    '--app-frame-background': '#0d1117',
    '--app-surface-background': '#131824',
    '--app-surface-background-soft': '#10141d',
    '--app-surface-background-muted': '#171d27',
    '--app-surface-level-1': '#161c27',
    '--app-surface-level-2': '#1a2132',
    '--app-card-background': '#161c27',
    '--app-card-active-background': 'rgba(31, 38, 50, 0.92)',
    '--app-control-background': 'rgba(19, 24, 33, 0.96)',
    '--app-control-background-soft': 'rgba(24, 29, 39, 0.98)',
    '--app-control-background-hover': 'rgba(31, 38, 50, 0.98)',
    '--app-brand-background': 'rgba(47, 140, 255, 0.14)',
    '--app-soft-glow': 'rgba(47, 140, 255, 0.1)',
    '--app-secondary-glow': 'rgba(255, 255, 255, 0.04)',
    '--app-shell-shadow': '0 18px 36px rgba(0, 0, 0, 0.24)',
    '--app-shell-shadow-strong': '0 24px 48px rgba(0, 0, 0, 0.3)',
    '--app-shell-shadow-soft': '0 12px 24px rgba(0, 0, 0, 0.18)',
    '--app-card-shadow-hover': '0 16px 28px rgba(0, 0, 0, 0.2)',
    '--app-card-shadow-active': '0 18px 34px rgba(47, 140, 255, 0.18)',
    '--app-dialog-background': '#131824',
    '--app-dialog-intro-background': 'rgba(47, 140, 255, 0.1)',
    '--app-dialog-warning-background': 'rgba(217, 163, 67, 0.1)',
    '--app-dialog-subtle-background': 'rgba(24, 29, 39, 0.92)',
    '--app-code-background': '#1e1f22',
    '--app-code-background-soft': '#2b2d30',
    '--app-code-text': '#dfe1e5',
    '--app-code-text-muted': '#b8bdc7',
    '--app-code-border': 'rgba(255, 255, 255, 0.08)',
    '--app-code-scroll-track': '#2b2d30',
    '--app-code-scroll-thumb': '#5b6168',
    '--app-code-scroll-thumb-hover': '#737983',
    '--app-primary-soft-surface': '#55a1ff',
    '--app-primary-strong-surface': '#2f8cff',
    '--app-primary-shadow': '0 12px 24px rgba(47, 140, 255, 0.22)',
    '--app-inset-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
    '--app-inset-highlight-soft': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)'
  }
}

const currentTheme = ref(getInitialTheme())

function getInitialTheme() {
  const saved = safeLocalStorage.getItem(THEME_STORAGE_KEY)
  if (saved && themes[saved]) {
    return saved
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function applyTheme(themeName) {
  const theme = themes[themeName]
  if (!theme) return

  const root = document.documentElement
  Object.keys(theme).forEach((key) => {
    if (key.startsWith('--')) {
      root.style.setProperty(key, theme[key])
    }
  })

  if (themeName === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  root.setAttribute('data-theme', themeName)
  root.style.colorScheme = themeName === 'dark' ? 'dark' : 'light'

  safeLocalStorage.setItem(THEME_STORAGE_KEY, themeName)
  currentTheme.value = themeName
}

function toggleTheme() {
  applyTheme(currentTheme.value === 'dark' ? 'light' : 'dark')
}

function setTheme(themeName) {
  if (themes[themeName]) {
    applyTheme(themeName)
  }
}

function getCurrentTheme() {
  return themes[currentTheme.value]
}

function getAvailableThemes() {
  return [themes.light, themes.dark]
}

function initTheme() {
  applyTheme(currentTheme.value)
}

if (window.matchMedia) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (e) => {
    if (!safeLocalStorage.getItem(THEME_STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light')
    }
  })
}

export function useTheme() {
  return {
    currentTheme,
    themes,
    setTheme,
    toggleTheme,
    getCurrentTheme,
    getAvailableThemes,
    initTheme
  }
}
