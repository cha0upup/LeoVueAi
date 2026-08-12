/**
 * 插件管理工具函数
 */

// ==================== 常量定义 ====================
const DEFAULT_PLUGIN_VERSION = '1.0.0'
const DEFAULT_PLUGIN_TYPE = 'java'

// 插件类型配置
export const PLUGIN_TYPES = [
  { value: 'java', label: 'java' },
  { value: 'php', label: 'PHP' },
  { value: 'javaScript', label: 'javaScript' },
  { value: 'shellCode', label: 'shellCode' }
]

// ==================== 表单工具函数 ====================
/**
 * 创建空的插件表单数据
 */
export function createEmptyPluginForm() {
  return {
    pluginId: '',
    pluginName: '',
    pluginDescription: '',
    version: DEFAULT_PLUGIN_VERSION,
    paramsDemo: '',
    bytecode: '',
    pluginType: DEFAULT_PLUGIN_TYPE,
    runtime: 'java',
    language: 'java'
  }
}

/**
 * 创建插件表单验证规则
 */
export function createPluginFormRules(options = {}) {
  const { requireBytecode = false } = options

  return {
    pluginName: [{ required: true, message: '插件名称不能为空', trigger: 'blur' }],
    pluginDescription: [{ required: true, message: '插件描述不能为空', trigger: 'blur' }],
    version: [{ required: true, message: '版本号不能为空', trigger: 'blur' }],
    ...(requireBytecode
      ? {
          bytecode: [{ required: true, message: '字节码不能为空', trigger: 'blur' }]
        }
      : {})
  }
}

/**
 * 从源对象赋值插件表单数据
 */
export function assignPluginForm(target, source = {}) {
  target.pluginId = source.pluginId || ''
  target.pluginName = source.pluginName || ''
  target.pluginDescription = source.pluginDescription || ''
  target.version = source.version || DEFAULT_PLUGIN_VERSION
  target.paramsDemo = source.paramsDemo || ''
  target.pluginType = source.pluginType || DEFAULT_PLUGIN_TYPE
  target.runtime = source.runtime || (target.pluginType === 'php' ? 'php' : 'java')
  target.language = source.language || target.pluginType
  target.bytecode = source.bytecode || ''
}

// ==================== 数据处理工具函数 ====================
/**
 * 构建插件更新参数，只包含有值的字段
 * @param {Object} pluginData - 插件数据
 * @returns {Object} 更新参数对象
 */
export function buildUpdateParams(pluginData) {
  const updateParams = {
    pluginId: pluginData.pluginId
  }

  // 只添加有值的字段
  if (pluginData.pluginName) updateParams.pluginName = pluginData.pluginName
  if (pluginData.pluginDescription) updateParams.pluginDescription = pluginData.pluginDescription
  if (pluginData.version) updateParams.version = pluginData.version
  if (pluginData.paramsDemo !== undefined) updateParams.paramsDemo = pluginData.paramsDemo
  if (pluginData.pluginType) updateParams.pluginType = pluginData.pluginType
  if (pluginData.runtime) updateParams.runtime = pluginData.runtime
  if (pluginData.language) updateParams.language = pluginData.language

  // 字节码：如果提供了新值才更新
  if (pluginData.bytecode && pluginData.bytecode.trim()) {
    if (pluginData.pluginType === 'java') updateParams.bytecode = pluginData.bytecode.trim()
    else updateParams.scriptContent = pluginData.bytecode.trim()
  }

  return updateParams
}

/**
 * 根据响应状态查找更新后的插件
 * @param {Array} plugins - 插件列表
 * @param {Object} response - API 响应对象
 * @param {string} currentPluginId - 当前插件ID
 * @returns {Object|null} 更新后的插件对象
 */
export function findUpdatedPlugin(plugins, response, currentPluginId) {
  if (response?.data?.pluginId && response.data.pluginId !== currentPluginId) {
    return plugins.find((p) => p.pluginId === response.data.pluginId) || null
  }
  return null
}
