import {
  createSqlDatabaseApi,
  createSqlTableApi,
  deleteSqlRowsApi,
  executeSqlQueryApi,
  exportSqlDatabaseApi,
  exportSqlTableApi,
  getSqlDatabasesApi,
  getSqlDialectsApi,
  getSqlRuntimeCapabilitiesApi,
  getSqlTableColumnsApi,
  getSqlTablesApi,
  insertSqlRowApi,
  querySqlTableApi,
  testSqlConnectionApi,
  updateSqlRowsApi
} from '@/services/api.js'

/**
 * SQL引擎
 * 统一处理各种数据库类型的SQL语句生成、配置管理与执行
 *
 * 内部组织结构：
 * 1. 连接管理 - 数据库配置
 * 2. 查询执行 - 请求构建与执行
 * 3. 元数据访问 - 数据库/表/列信息获取
 * 4. 配置工具 - 数据库类型配置、数据类型定义
 */
class SqlEngine {
  constructor() {
    // ===== 连接管理 =====
    // 方言目录由后端 SqlDialectRegistry 动态加载。
    this.dbConfigs = {}
    this.dialectAliases = {}
  }

  _buildConnectionPayload(connection = {}) {
    return {
      connectionId: connection.connectionId || '',
      dialect: connection.dialect || '',
      connectionMode: connection.connectionMode || '',
      variant: connection.variant || '',
      host: connection.host || '',
      port: connection.port ?? null,
      database: connection.database || '',
      service: connection.service || '',
      sid: connection.sid || '',
      file: connection.file || '',
      username: connection.username || '',
      password: connection.password || '',
      timeoutSeconds: connection.timeoutSeconds ?? 30,
      options: connection.options || {},
      dialectOptions: connection.dialectOptions || {},
      runtimeOptions: connection.runtimeOptions || {}
    }
  }

  _buildRequestWithConnection(params = {}) {
    const { sessionId, connection, ...rest } = params
    delete rest.signal
    return {
      sessionId,
      connection: this._buildConnectionPayload(connection),
      ...rest
    }
  }

  _buildObjectRequest(params = {}) {
    const request = this._buildRequestWithConnection(params)
    delete request.database
    delete request.table
    delete request.tables
    return request
  }

  _buildRequestConfig(params = {}) {
    return params.signal ? { signal: params.signal } : undefined
  }

  // ===== 元数据访问 =====
  async testConnection(params) {
    const response = await testSqlConnectionApi(
      this._buildRequestWithConnection(params),
      this._buildRequestConfig(params)
    )
    const result = response?.data
    if (result?.success === false) {
      const error = new Error(result.message || '数据库连接测试失败')
      error.connectionTest = result
      throw error
    }
    return response
  }

  getRuntimeCapabilities(params) {
    return getSqlRuntimeCapabilitiesApi(this._buildRequestWithConnection(params))
  }

  getDialects() {
    return getSqlDialectsApi()
  }

  async refreshDialectCatalog() {
    this.clearDialectCatalog()
    const response = await this.getDialects()
    if (!this.applyDialectCatalog(response?.data)) {
      throw new Error('SQL 方言目录为空或格式无效')
    }
    return true
  }

  clearDialectCatalog() {
    this.dbConfigs = {}
    this.dialectAliases = {}
  }

  applyDialectCatalog(catalog) {
    if (!Array.isArray(catalog) || catalog.length === 0) return false
    const configs = {}
    const aliases = {}
    for (const item of catalog) {
      const type = String(item?.type || '').trim().toLowerCase()
      if (!type || !item?.name || !Array.isArray(item?.variants)) continue
      configs[type] = {
        name: String(item.name),
        defaultPort: item.defaultPort ?? null,
        variants: item.variants.map((variant) => ({
          key: String(variant?.key || ''),
          name: String(variant?.name || variant?.key || ''),
          fields: Array.isArray(variant?.fields) ? [...variant.fields] : []
        })),
        dataTypes: Array.isArray(item.dataTypes) ? item.dataTypes.map((dataType) => ({ ...dataType })) : [],
        aliases: Array.isArray(item.aliases) ? [...item.aliases] : [],
        connectionModes: Array.isArray(item.connectionModes) ? [...item.connectionModes] : [],
        namespaceLevels: Array.isArray(item.namespaceLevels) ? [...item.namespaceLevels] : [],
        runtimeSupport: item.runtimeSupport || {},
        capabilities: item.capabilities || {}
      }
      aliases[type] = type
      for (const alias of configs[type].aliases) {
        const normalized = String(alias || '').trim().toLowerCase()
        if (normalized) aliases[normalized] = type
      }
    }
    if (Object.keys(configs).length === 0) return false
    this.dbConfigs = configs
    this.dialectAliases = aliases
    return true
  }

  getDatabases(params) {
    return getSqlDatabasesApi(
      this._buildRequestWithConnection(params),
      this._buildRequestConfig(params)
    )
  }

  getTables(params) {
    return getSqlTablesApi(
      this._buildObjectRequest(params),
      this._buildRequestConfig(params)
    )
  }

  getTableColumns(params) {
    return getSqlTableColumnsApi(
      this._buildObjectRequest(params),
      this._buildRequestConfig(params)
    )
  }

  queryTable(params) {
    return querySqlTableApi(
      this._buildObjectRequest(params),
      this._buildRequestConfig(params)
    )
  }

  executeQuery(params) {
    return executeSqlQueryApi(
      this._buildRequestWithConnection(params),
      this._buildRequestConfig(params)
    )
  }

  createDatabase(params) {
    return createSqlDatabaseApi(this._buildRequestWithConnection(params))
  }

  createTable(params) {
    return createSqlTableApi(this._buildObjectRequest(params))
  }

  insertRow(params) {
    return insertSqlRowApi(this._buildObjectRequest(params))
  }

  updateRows(params) {
    return updateSqlRowsApi(this._buildObjectRequest(params))
  }

  deleteRows(params) {
    return deleteSqlRowsApi(this._buildObjectRequest(params))
  }

  exportTable(params) {
    return exportSqlTableApi(this._buildObjectRequest(params))
  }

  exportDatabase(params) {
    return exportSqlDatabaseApi(this._buildObjectRequest(params))
  }

  // ===== 配置工具 =====
  /**
   * 获取所有支持的数据库类型配置
   * @returns {Array} 数据库配置数组
   */
  getSupportedDatabases() {
    return Object.keys(this.dbConfigs).map((type) => ({
      type: type,
      name: this.dbConfigs[type].name,
      defaultPort: this.dbConfigs[type].defaultPort
    }))
  }

  /**
   * 获取指定数据库类型的配置信息
   * @param {string} dialect SQL 方言
   * @returns {Object} 数据库配置对象
   */
  getDatabaseConfig(dialect) {
    const type = this.normalizeDialect(dialect)
    return this.dbConfigs[type] || null
  }

  getDialectName(dialect) {
    return this.getDatabaseConfig(dialect)?.name || dialect || '-'
  }

  getCapabilities(dialect) {
    return this.getDatabaseConfig(dialect)?.capabilities || {}
  }

  hasCapability(dialect, capability) {
    return this.getCapabilities(dialect)?.[capability] === true
  }

  getNamespaceLevels(dialect) {
    const levels = this.getDatabaseConfig(dialect)?.namespaceLevels
    return Array.isArray(levels) ? [...levels] : []
  }

  getDataTypeOptions(dialect) {
    const config = this.getDatabaseConfig(dialect)
    if (!config) return []
    return config.dataTypes.map((dataType) => ({
      value: dataType.type,
      label: dataType.type
    }))
  }

  /**
   * 获取数据类型的默认参数
   * @param {string} dataType 数据类型
   * @returns {Object} 默认参数对象
   */
  getDataTypeDefaults(dialect, dataType) {
    const config = this.getDatabaseConfig(dialect)
    const metadata = config?.dataTypes.find((item) => item.type === dataType)
    if (!metadata) return { hasLength: false, hasPrecision: false, hasScale: false }
    const hasLength = metadata.defaultLength != null
    const hasPrecision = metadata.defaultPrecision != null
    const hasScale = metadata.defaultScale != null
    return {
      hasLength,
      hasPrecision,
      hasScale,
      defaultLength: metadata.defaultLength,
      defaultPrecision: metadata.defaultPrecision,
      defaultScale: metadata.defaultScale,
      placeholder: hasLength
        ? String(metadata.defaultLength)
        : hasPrecision
          ? `${metadata.defaultPrecision}${hasScale ? `,${metadata.defaultScale}` : ''}`
          : ''
    }
  }
  /**
   * 获取变体列表
   */
  getVariants(dialect) {
    const cfg = this.getDatabaseConfig(dialect)
    if (!cfg || !Array.isArray(cfg.variants)) return []
    return cfg.variants.map((v) => ({
      key: v.key,
      name: v.name,
      fields: Array.isArray(v.fields) ? [...v.fields] : []
    }))
  }
  /**
   * 标准化 SQL 方言
   * @param {string} dialect SQL 方言
   * @returns {string} 标准化的 SQL 方言
   */
  normalizeDialect(dialect) {
    const type = String(dialect || '').trim().toLowerCase()
    if (!type) return ''
    return this.dialectAliases[type] || (this.dbConfigs[type] ? type : '')
  }
}

// 创建单例实例
const sqlEngine = new SqlEngine()

export default sqlEngine
