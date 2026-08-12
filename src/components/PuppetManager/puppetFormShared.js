import { PERMISSIONS, PROTOCOLS, PUPPET_FORM_RULES, PUPPET_TYPES } from '@/utils/constants.js'

export const PUPPET_PERMISSION_OPTIONS = PERMISSIONS
export const PUPPET_PROTOCOL_OPTIONS = PROTOCOLS
export const PUPPET_TYPE_OPTIONS = PUPPET_TYPES

export const PUPPET_PROXY_OPTIONS = [
  { label: 'HTTP代理', value: 'http' },
  { label: 'SOCKS代理', value: 'socks' },
  { label: '直连', value: 'direct' }
]

export function createPuppetDialogRules(options = {}) {
  const {
    nameRequiredMessage = '请输入主机名称',
    connLinkPattern = null,
    connLinkPatternMessage = '请输入有效的连接地址',
    requireDisguises = false
  } = options

  const nameRules =
    nameRequiredMessage === PUPPET_FORM_RULES.puppetName[0]?.message
      ? PUPPET_FORM_RULES.puppetName
      : [
          { ...PUPPET_FORM_RULES.puppetName[0], message: nameRequiredMessage },
          ...PUPPET_FORM_RULES.puppetName.slice(1)
        ]

  const connLinkRules = [...PUPPET_FORM_RULES.connLink]
  if (connLinkPattern) {
    connLinkRules.push({
      pattern: connLinkPattern,
      message: connLinkPatternMessage,
      trigger: 'blur'
    })
  }

  const rules = {
    puppetName: nameRules,
    connLink: connLinkRules,
    protocol: PUPPET_FORM_RULES.protocol,
    type: PUPPET_FORM_RULES.type,
    permission: PUPPET_FORM_RULES.permission,
    maxReqCount: PUPPET_FORM_RULES.maxReqCount,
    proxyHost: PUPPET_FORM_RULES.proxyHost,
    proxyPort: PUPPET_FORM_RULES.proxyPort
  }

  if (requireDisguises) {
    rules.reqDisguiseId = [{ required: true, message: '请选择请求伪装', trigger: 'change' }]
    rules.respDisguiseId = [{ required: true, message: '请选择响应伪装', trigger: 'change' }]
  }

  return rules
}
