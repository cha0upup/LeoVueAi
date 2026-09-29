import { computed, ref } from 'vue'
import sqlEngine from './SqlEngine.js'
import {
  DEFAULT_DATABASE_USER,
  DATABASE_FORM_RULES,
  getAllDatabaseTemplates,
  testDatabaseConnection
} from '@/utils/database.js'

export const databaseConfigFormRules = DATABASE_FORM_RULES

function prettyJson(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return JSON.stringify(source, null, 2)
}

function parseJsonObject(text) {
  const value = String(text || '').trim()
  if (!value) return { valid: true, value: {} }
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, value: {} }
    }
    return { valid: true, value: parsed }
  } catch {
    return { valid: false, value: {} }
  }
}

export function createRuntimeOptions(source = {}) {
  return {
    java: {
      jdbcUrl: source?.java?.jdbcUrl || '',
      driverClass: source?.java?.driverClass || '',
      propertiesText: prettyJson(source?.java?.connectionProperties || {})
    },
    php: {
      dsn: source?.php?.dsn || '',
      pdoDriver: source?.php?.pdoDriver || ''
    }
  }
}

export function createDatabaseConfigForm() {
  return {
    dialect: '',
    connectionMode: 'standard',
    variant: '',
    host: 'localhost',
    port: 3306,
    database: '',
    service: '',
    sid: '',
    file: '',
    username: DEFAULT_DATABASE_USER,
    password: '',
    timeoutSeconds: 30,
    optionsText: '{}',
    testSql: 'SELECT 1 AS version',
    runtimeOptions: createRuntimeOptions()
  }
}

export function resetDatabaseConfigForm(form, formRef) {
  formRef.value?.resetFields?.()
  Object.assign(form, createDatabaseConfigForm())
  formRef.value?.clearValidate?.()
}

export function createEditingDatabaseConfigForm(config) {
  const { connection } = config
  return {
    ...createDatabaseConfigForm(),
    dialect: connection.dialect,
    connectionMode: connection.connectionMode,
    variant: connection.variant || '',
    host: connection.host ?? 'localhost',
    port: connection.port ?? sqlEngine.getDatabaseConfig(connection.dialect)?.defaultPort ?? 3306,
    database: connection.database || '',
    service: connection.service || '',
    sid: connection.sid || '',
    file: connection.file || '',
    username: connection.username || '',
    password: '',
    timeoutSeconds: connection.timeoutSeconds ?? 30,
    optionsText: prettyJson(connection.options),
    testSql: connection.dialectOptions?.testSql ?? 'SELECT 1 AS version',
    runtimeOptions: createRuntimeOptions(connection.runtimeOptions)
  }
}

export function buildDatabaseConnection(form, { omitEmptyPassword = false } = {}) {
  const options = parseJsonObject(form.optionsText).value
  const javaProperties = parseJsonObject(form.runtimeOptions?.java?.propertiesText).value
  const runtimeOptions = {}
  const java = form.runtimeOptions?.java || {}
  const php = form.runtimeOptions?.php || {}
  if (java.jdbcUrl?.trim() || java.driverClass?.trim() || Object.keys(javaProperties).length > 0) {
    runtimeOptions.java = {
      jdbcUrl: java.jdbcUrl?.trim() || '',
      driverClass: java.driverClass?.trim() || '',
      connectionProperties: javaProperties
    }
  }
  if (php.dsn?.trim() || php.pdoDriver?.trim()) {
    runtimeOptions.php = {
      dsn: php.dsn?.trim() || '',
      pdoDriver: php.pdoDriver?.trim() || ''
    }
  }
  const connection = {
    dialect: form.dialect,
    connectionMode: form.connectionMode,
    variant: form.variant || (form.dialect === 'sqlite' ? 'file' : 'default'),
    host: form.connectionMode === 'standard' && form.dialect !== 'sqlite' ? form.host : '',
    port:
      form.connectionMode === 'standard' && form.dialect !== 'sqlite' ? Number(form.port) : null,
    database: form.database || '',
    service: form.service || '',
    sid: form.sid || '',
    file: form.file || '',
    username: form.username || '',
    timeoutSeconds: Number(form.timeoutSeconds) || 30,
    options,
    dialectOptions:
      form.dialect === 'generic' ? { testSql: form.testSql?.trim() || 'SELECT 1 AS version' } : {},
    runtimeOptions
  }
  if (!omitEmptyPassword || form.password) connection.password = form.password || ''
  return connection
}

export async function verifySavedDatabaseConnection({ sessionId, response }) {
  if (response?.data?.status === 0) return null
  const connectionId = response?.data?.connectionId
  if (!connectionId) return null
  return sqlEngine.testConnection({
    sessionId,
    connection: { connectionId }
  })
}

function runtimePairState(first, second) {
  const hasFirst = Boolean(first?.trim())
  const hasSecond = Boolean(second?.trim())
  return {
    configured: hasFirst && hasSecond,
    valid: hasFirst === hasSecond
  }
}

function isDatabaseConnectionComplete(form, runtime, runtimeSupport, connectionModes) {
  if (!form.dialect || !parseJsonObject(form.optionsText).valid) return false
  if (!connectionModes.includes(form.connectionMode)) return false
  if (form.dialect === 'generic' && !form.testSql?.trim()) return false
  if (!parseJsonObject(form.runtimeOptions?.java?.propertiesText).valid) return false

  const java = runtimePairState(
    form.runtimeOptions?.java?.driverClass,
    form.runtimeOptions?.java?.jdbcUrl
  )
  const php = runtimePairState(form.runtimeOptions?.php?.pdoDriver, form.runtimeOptions?.php?.dsn)
  if (!java.valid || !php.valid) return false
  if (form.connectionMode === 'custom') {
    if (runtime === 'java') return java.configured
    if (runtime === 'php') return php.configured
    return java.configured || php.configured
  }

  if (runtime && runtimeSupport[runtime] === false) return false
  if (form.dialect === 'sqlite') return Boolean(form.file)
  if (!form.host || !form.port) return false
  if (form.dialect === 'oracle') {
    return form.variant === 'sid' ? Boolean(form.sid) : Boolean(form.service)
  }
  return form.dialect !== 'generic'
}

export function useDatabaseConfigDialogBase({ form, templates, sessionId }) {
  const runtimeCapabilities = ref(null)
  const runtimeCapabilitiesLoading = ref(false)
  const dialectCatalogLoading = ref(false)
  const dialectCatalogError = ref('')
  const connectionTestResult = ref(null)
  let capabilityRequestId = 0
  const selectedTemplate = computed(
    () => templates.value.find((template) => template.value === form.dialect) || null
  )
  const variants = computed(() => selectedTemplate.value?.variants || [])
  const dialectGroups = computed(() => {
    const builtIn = templates.value.filter((template) => template.value !== 'generic')
    const generic = templates.value.filter((template) => template.value === 'generic')
    return [
      builtIn.length ? { value: 'builtin', label: '内置方言', options: builtIn } : null,
      generic.length
        ? { value: 'generic', label: '通用 SQL / 自定义数据库', options: generic }
        : null
    ].filter(Boolean)
  })
  const connectionModeOptions = computed(() => {
    const modes = selectedTemplate.value?.connectionModes || []
    return modes.map((value) => ({
      value,
      label: value === 'custom' ? '自定义运行时' : '标准配置'
    }))
  })
  const selectedVariant = computed(
    () =>
      variants.value.find((variant) => variant.key === form.variant) || variants.value[0] || null
  )
  const visibleFields = computed(() => new Set(selectedVariant.value?.fields || []))
  const currentRuntime = computed(() => runtimeCapabilities.value?.runtime || '')
  const runtimeReady = computed(() => {
    if (runtimeCapabilitiesLoading.value) return false
    const capabilities = runtimeCapabilities.value
    if (!capabilities || Number(capabilities.code) !== 200) return true
    if (capabilities.available === false) return false
    return capabilities.requestedDriver?.available !== false
  })
  const isComplete = computed(
    () =>
      !dialectCatalogLoading.value &&
      !dialectCatalogError.value &&
      Boolean(selectedTemplate.value) &&
      isDatabaseConnectionComplete(
        form,
        currentRuntime.value,
        selectedTemplate.value.runtimeSupport,
        selectedTemplate.value.connectionModes
      ) &&
      runtimeReady.value
  )

  const loadDatabaseTemplates = async () => {
    dialectCatalogLoading.value = true
    dialectCatalogError.value = ''
    templates.value = []
    try {
      await sqlEngine.refreshDialectCatalog()
      templates.value = getAllDatabaseTemplates(sqlEngine)
      return templates.value
    } catch (error) {
      sqlEngine.clearDialectCatalog()
      templates.value = []
      dialectCatalogError.value = error?.message || 'SQL 方言目录加载失败'
      return []
    } finally {
      dialectCatalogLoading.value = false
    }
  }

  const syncDialectSelection = () => {
    if (!selectedTemplate.value) return
    const defaultVariant = variants.value[0]
    form.variant = defaultVariant?.key || ''
    if (selectedTemplate.value.defaultPort) form.port = selectedTemplate.value.defaultPort
    if (!selectedTemplate.value.connectionModes.includes(form.connectionMode)) form.connectionMode = 'custom'
    if (form.dialect === 'sqlite') form.username = ''
    else if (!form.username) form.username = DEFAULT_DATABASE_USER
  }

  const inspectRuntimeCapabilities = async () => {
    const requestId = ++capabilityRequestId
    runtimeCapabilitiesLoading.value = true
    try {
      const response = await sqlEngine.getRuntimeCapabilities({
        sessionId,
        connection: buildDatabaseConnection(form)
      })
      if (requestId === capabilityRequestId) {
        runtimeCapabilities.value = response?.data || null
      }
      return runtimeCapabilities.value
    } catch (error) {
      if (requestId === capabilityRequestId) {
        runtimeCapabilities.value = {
          code: error?.response?.data?.code || 500,
          available: null,
          msg: error?.message || '运行时能力探测失败'
        }
      }
      return runtimeCapabilities.value
    } finally {
      if (requestId === capabilityRequestId) runtimeCapabilitiesLoading.value = false
    }
  }

  const resetRuntimeState = () => {
    capabilityRequestId += 1
    runtimeCapabilities.value = null
    runtimeCapabilitiesLoading.value = false
    connectionTestResult.value = null
  }

  const testConnectionOnly = async () => {
    const result = await testDatabaseConnection({
      sessionId,
      connection: buildDatabaseConnection(form),
      sqlEngine
    })
    connectionTestResult.value = result
    return result
  }

  return {
    selectedTemplate,
    variants,
    dialectGroups,
    connectionModeOptions,
    visibleFields,
    isComplete,
    runtimeCapabilities,
    runtimeCapabilitiesLoading,
    dialectCatalogLoading,
    dialectCatalogError,
    connectionTestResult,
    loadDatabaseTemplates,
    syncDialectSelection,
    inspectRuntimeCapabilities,
    resetRuntimeState,
    testConnectionOnly
  }
}
