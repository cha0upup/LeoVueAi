import { icons } from '@/utils/icons.js'

export const ROUTE_PATHS = {
  root: '/',
  main: '/main',
  mainPuppetBase: '/main/puppet',
  mainPuppet: '/main/puppet/:tabKey',
  login: '/login',
  changePassword: '/change-password',
  admin: '/admin'
}

export const ROUTE_NAMES = {
  main: 'Main',
  mainPuppet: 'MainPuppet',
  login: 'Login',
  changePassword: 'ChangePassword',
  admin: 'AdminConsole'
}

export const getPuppetTabPath = (tabKey) => {
  return `${ROUTE_PATHS.mainPuppetBase}/${encodeURIComponent(tabKey)}`
}

export const DEFAULT_USERNAME = '管理员'
export const DEFAULT_HOME_MENU_KEY = 'puppet'
export const MAIN_HOME_TAB_ID = 'HOME'
export const THEME_STORAGE_KEY = 'leovue-theme'
export const PUPPET_CONSOLE_SETTINGS_STORAGE_KEY = 'puppet-console-settings'

export const MAIN_TAB_STORAGE_KEYS = {
  tabs: 'leovue-tabs',
  currentTab: 'leovue-current-tab'
}

export const LOAD_DELAYS = {
  tabContent: 800,
  loginRedirect: 500
}

/** 与后端认证字段硬边界保持一致；密码最小长度仍可能由服务端配置提高。 */
export const AUTH_FIELD_LIMITS = Object.freeze({
  usernameMaxLength: 100,
  passwordMinLength: 6,
  passwordMaxLength: 256
})

/** 工作台导航按使用流程分组。 */
export const HOME_MENU_GROUPS = [
  {
    key: 'workspace',
    kicker: 'Operations',
    title: '运行工作台',
    items: [
      { key: 'puppet', title: '主机资产', icon: icons.server },
      { key: 'task-center', title: '任务总览', icon: icons.task }
    ]
  },
  {
    key: 'generate',
    kicker: 'Build',
    title: '构建与交付',
    items: [
      { key: 'hostgen', title: '脚本构建', icon: icons.codeGenerator },
      { key: 'user-space', title: '成果库', icon: icons.folderOpened }
    ]
  },
  {
    key: 'configure',
    kicker: 'Governance',
    title: '策略与扩展',
    items: [
      { key: 'disguise', title: '流量策略', icon: icons.mask },
      { key: 'plugin', title: '扩展管理', icon: icons.plugin },
      { key: 'fingerprint', title: '指纹规则', icon: icons.fingerprint },
      { key: 'skill', title: '能力库', icon: icons.bookOpenPageVariant }
    ]
  }
]
