import { icons } from '@/utils/icons.js'

export const adminTabGroups = [
  {
    name: 'Identity', label: '账号与组织', tabs: [
      { name: 'users', label: '用户管理', icon: icons.user, load: () => import('./users/UserManager.vue') },
      { name: 'teams', label: '团队管理', icon: icons.userFilled, load: () => import('./teams/TeamManager.vue') }
    ]
  },
  {
    name: 'Governance', label: '审计治理', adminOnly: true, tabs: [
      { name: 'audit', label: '审计日志', icon: icons.document, load: () => import('./audit/AuditManager.vue') },
      { name: 'statistics', label: '审计统计', icon: icons.trendCharts, load: () => import('./audit/AuditStatistics.vue') }
    ]
  },
  {
    name: 'System', label: '系统能力', adminOnly: true, tabs: [
      { name: 'system', label: 'AI 模型接入', icon: icons.settings, load: () => import('../Settings/AiChannelSettings.vue') }
    ]
  }
]
