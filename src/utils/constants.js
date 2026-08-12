/**
 * 全局常量定义
 * 统一管理应用中的常量配置
 */

/**
 * 权限选项列表
 */
export const PERMISSIONS = [
  { value: 'private', label: '私有' },
  { value: 'team', label: '团队可见' },
  { value: 'public', label: '公开' }
]

/**
 * 协议列表
 */
export const PROTOCOLS = [
  { value: 'http', label: 'HTTP' },
  { value: 'httpChunked', label: 'HTTP Chunked' },
  { value: 'websocket', label: 'WebSocket' }
]

/**
 * Puppet 节点类型列表
 */
export const PUPPET_TYPES = [
  { value: 'java', label: 'Java' },
  { value: 'php', label: 'PHP' }
]

/** 最大请求数表示一次操作的请求总数，包含首次请求。 */
export const PUPPET_MIN_REQUEST_COUNT = 1
export const PUPPET_MAX_REQUEST_COUNT = 10
export const PUPPET_DEFAULT_MAX_REQUEST_COUNT = PUPPET_MIN_REQUEST_COUNT

/**
 * Puppet 对象的默认值
 */
const DEFAULT_PUPPET = {
  puppetId: '',
  parentPuppetId: 'root',
  puppetName: '',
  createByUserId: '',
  connLink: '',
  reqDisguiseId: '',
  respDisguiseId: '',
  headers: '',
  permission: 'private',
  proxyEnabled: 0,
  maxReqCount: PUPPET_DEFAULT_MAX_REQUEST_COUNT,
  proxyType: 'direct',
  proxyHost: '127.0.0.1',
  proxyPort: 8080,
  protocol: 'http',
  type: 'java',
  heartbeatInterval: 30000,
  remark: '',
  urlStrategy: '',
  paddingStrategy: '',
  headerNoiseStrategy: '',
  tlsFingerprintStrategy: ''
}

/**
 * 创建新的 Puppet 对象（深拷贝默认值）
 * @param {Object} overrides - 覆盖默认值的属性
 * @returns {Object} 新的 Puppet 对象
 */
export function createDefaultPuppet(overrides = {}) {
  return {
    ...DEFAULT_PUPPET,
    ...overrides
  }
}

/**
 * Puppet 表单验证规则
 * 统一管理所有 Puppet 相关表单的验证规则
 */
export const PUPPET_FORM_RULES = {
  puppetName: [
    { required: true, message: '请输入主机名称', trigger: 'blur' },
    { min: 2, max: 50, message: '主机名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  connLink: [{ required: true, message: '请输入连接地址', trigger: 'blur' }],
  protocol: [{ required: true, message: '请选择传输协议', trigger: 'change' }],
  type: [{ required: true, message: '请选择节点类型', trigger: 'change' }],
  permission: [{ required: true, message: '请选择访问权限', trigger: 'change' }],
  maxReqCount: [
    { required: true, message: '请输入最大请求数', trigger: 'blur' },
    {
      type: 'number',
      min: PUPPET_MIN_REQUEST_COUNT,
      max: PUPPET_MAX_REQUEST_COUNT,
      message: `最大请求数在 ${PUPPET_MIN_REQUEST_COUNT} 到 ${PUPPET_MAX_REQUEST_COUNT} 之间`,
      trigger: 'blur'
    }
  ],
  proxyHost: [{ required: true, message: '请输入代理地址', trigger: 'blur' }],
  proxyPort: [
    { required: true, message: '请输入代理端口', trigger: 'blur' },
    { type: 'number', min: 1, max: 65535, message: '端口号在 1 到 65535 之间', trigger: 'blur' }
  ]
}
