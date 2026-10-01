import { PERMISSIONS, PROTOCOLS, AGENT_FORM_RULES, AGENT_TYPES } from '@/utils/constants.js'

export const AGENT_PERMISSION_OPTIONS = PERMISSIONS
export const AGENT_PROTOCOL_OPTIONS = PROTOCOLS
export const AGENT_TYPE_OPTIONS = AGENT_TYPES

export const AGENT_PROXY_OPTIONS = [
  { label: 'HTTP代理', value: 'http' },
  { label: 'SOCKS代理', value: 'socks' },
  { label: '直连', value: 'direct' }
]

export function createAgentDialogRules(options = {}) {
  const {
    nameRequiredMessage = '请输入主机名称',
    connLinkPattern = null,
    connLinkPatternMessage = '请输入有效的连接地址',
    requireDisguises = false,
    requirePayloadKeyForJava = null
  } = options

  const nameRules =
    nameRequiredMessage === AGENT_FORM_RULES.agentName[0]?.message
      ? AGENT_FORM_RULES.agentName
      : [
          { ...AGENT_FORM_RULES.agentName[0], message: nameRequiredMessage },
          ...AGENT_FORM_RULES.agentName.slice(1)
        ]

  const connLinkRules = [...AGENT_FORM_RULES.connLink]
  if (connLinkPattern) {
    connLinkRules.push({
      pattern: connLinkPattern,
      message: connLinkPatternMessage,
      trigger: 'blur'
    })
  }

  const rules = {
    agentName: nameRules,
    connLink: connLinkRules,
    protocol: AGENT_FORM_RULES.protocol,
    type: AGENT_FORM_RULES.type,
    permission: AGENT_FORM_RULES.permission,
    maxReqCount: AGENT_FORM_RULES.maxReqCount,
    proxyHost: AGENT_FORM_RULES.proxyHost,
    proxyPort: AGENT_FORM_RULES.proxyPort
  }

  if (requireDisguises) {
    rules.reqDisguiseId = [{ required: true, message: '请选择请求伪装', trigger: 'change' }]
    rules.respDisguiseId = [{ required: true, message: '请选择响应伪装', trigger: 'change' }]
  }

  if (requirePayloadKeyForJava) {
    rules.payloadKey = [{
      validator: (rule, value, callback) => {
        if (requirePayloadKeyForJava() && !String(value || '').trim()) {
          callback(new Error('请输入 Java 节点 AES 密钥'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }]
  }

  return rules
}
