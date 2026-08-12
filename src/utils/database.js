/**
 * 数据库管理工具函数集合
 * 包含数据库配置、表单验证、数据格式化等功能
 */

// 布尔值常量
const BOOLEAN_TRUE_VALUES = ['1', 'true', 'YES', 'Y']
const BOOLEAN_FALSE_VALUES = ['0', 'false', 'NO', 'N']
// 无效日期时间值
const INVALID_DATETIME_VALUES = ['0000-00-00', '0000-00-00 00:00:00']

// 默认用户名
export const DEFAULT_DATABASE_USER = 'root'

// 表单验证规则
export const DATABASE_FORM_RULES = {
  dialect: [{ required: true, message: '请选择 SQL 方言', trigger: 'change' }],
  host: [{ required: true, message: '请输入主机地址', trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口', trigger: 'blur' }],
  file: [{ required: true, message: '请输入数据库文件路径', trigger: 'blur' }]
}

// 方言标签颜色属于前端展示元数据；名称、能力和连接契约来自后端方言目录。
const DIALECT_TAG_TYPES = {
  mysql: 'success',
  postgresql: 'primary',
  sqlserver: 'warning',
  oracle: 'danger',
  dm: 'danger',
  kingbasees: 'warning',
  sqlite: 'info',
  generic: 'info'
}

const DATABASE_TEST_STATUS = {
  0: { label: '未检测', type: 'info' },
  1: { label: '连接正常', type: 'success' },
  2: { label: '连接异常', type: 'danger' }
}

// 分页相关常量
export const DEFAULT_PAGE_SIZE_SMALL = 10

// 消息文本常量
export const DATABASE_MESSAGES = {
  CONFIG_REQUIRED: '请先配置数据库连接',
  TABLE_REQUIRED: '请先选择数据表',
  SELECT_ROW_REQUIRED: '请先选择要编辑的数据行',
  SELECT_DELETE_REQUIRED: '请先选择要删除的数据行',
  SELECT_EXPORT_REQUIRED: '请先选择要导出的表',
  NO_DATA_EXPORT: '没有数据可导出',
  CREATE_SUCCESS: '创建成功',
  DELETE_SUCCESS: '删除成功',
  UPDATE_SUCCESS: '更新成功',
  GET_DATA_FAILED: '获取表数据失败',
  DELETE_FAILED: '删除数据失败',
  UPDATE_FAILED: '更新数据失败',
  EXPORT_FAILED: '导出数据失败',
  DATABASE_INFO_FAILED: '无法获取数据库信息',
  NO_TABLES: '该数据库中没有表',
  GET_TABLES_FAILED: '获取表列表失败',
  EXPORT_TASK_FAILED: '导出任务启动失败',
  ONE_ROW_ONLY: '一次只能编辑一条数据'
}

// 对话框配置常量
export const DATABASE_DIALOG_CONFIG = {
  CREATE_DB: {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
    inputPattern: /^[A-Za-z0-9_]+$/,
    inputErrorMessage: '只允许字母、数字与下划线'
  },
  EXPORT_DB: {
    confirmButtonText: '确定导出',
    cancelButtonText: '取消',
    type: 'warning'
  },
  CREATE_TABLE: {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
    type: 'info'
  }
}

// 标签页相关常量
export const DATABASE_TAB_CONSTANTS = {
  HOME_TAB_ID: '首页',
  HOME_TAB_TITLE: '首页',
  UNCONFIGURED_CONNECTION: '未配置连接',
  URL_MAX_LENGTH: 36,
  URL_PREFIX_LENGTH: 18,
  URL_SUFFIX_LENGTH: 12
}

// ==================== 数据格式化函数 ====================
/**
 * 格式化单元格值，根据字段类型进行智能转换
 * @param {*} cell - 单元格值
 * @param {Object} column - 列元数据
 * @returns {*} 格式化后的值
 */
export function formatCellValue(cell, column) {
  if (cell === null || cell === undefined) {
    return '(NULL)'
  }

  const type = String(column.type || '').toLowerCase()
  const value = String(cell).trim()

  // 处理布尔值类型
  if (type.includes('bool') || type.includes('bit')) {
    if (BOOLEAN_TRUE_VALUES.includes(value)) return 'true'
    if (BOOLEAN_FALSE_VALUES.includes(value)) return 'false'
    return value
  }

  // 精确数值保持原始文本，避免 BIGINT、DECIMAL 和 NUMBER 被 JS Number 截断。
  if (
    type.includes('int') ||
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('double') ||
    type.includes('numeric')
  ) {
    return value
  }

  // 处理日期时间类型
  if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
    if (value && !INVALID_DATETIME_VALUES.includes(value)) {
      return value
    }
    return ''
  }

  // 字符串保持原值，不再根据字段名猜测布尔语义。
  if (type.includes('char') || type.includes('text') || type.includes('varchar')) {
    return value
  }

  return value
}

// ==================== 表单输入工具函数 ====================
/**
 * 根据列类型获取对应的输入组件
 * @param {string} columnType - 列类型
 * @returns {string} 组件名
 */
export function getInputComponentByType(columnType) {
  if (!columnType) return 'el-input'

  const type = String(columnType).toLowerCase()

  if (type.includes('int') || type.includes('decimal') || type.includes('numeric')) {
    return 'el-input'
  }
  if (type.includes('float') || type.includes('double')) {
    return 'el-input-number'
  }
  if (type.includes('date') || type.includes('time')) {
    return 'el-date-picker'
  }
  if (type.includes('bool') || type.includes('bit')) {
    return 'el-select'
  }
  return 'el-input'
}

/**
 * 根据列类型和元数据获取输入组件的属性
 * @param {string} columnType - 列类型
 * @param {Object} columnMeta - 列元数据
 * @param {string} mode - 模式 ('insert' | 'update')
 * @returns {Object} 组件属性
 */
export function getInputPropsByType(columnType, columnMeta = {}) {
  if (!columnType) return { size: 'default' }

  const type = String(columnType).toLowerCase()
  const meta = {
    nullable: columnMeta.nullable === 'YES' || columnMeta.nullable === true,
    maxLength: columnMeta.length || columnMeta.maxLength
  }

  const baseProps = { size: 'default' }

  if (type.includes('date') || type.includes('time')) {
    return {
      ...baseProps,
      type: 'datetime',
      format: 'YYYY-MM-DD HH:mm:ss',
      'value-format': 'YYYY-MM-DD HH:mm:ss',
      style: 'width: 100%'
    }
  }
  if (type.includes('bool') || type.includes('bit')) {
    return {
      ...baseProps,
      style: 'width: 100%'
    }
  }
  if (type.includes('text') || type.includes('blob')) {
    return {
      ...baseProps,
      type: 'textarea',
      autosize: { minRows: 2, maxRows: 4 },
      maxlength: meta.maxLength
    }
  }
  return {
    ...baseProps,
    maxlength: meta.maxLength
  }
}

/**
 * 获取列的元数据信息
 * @param {Object} column - 列对象
 * @returns {Object} 元数据
 */
export function getColumnMetaInfo(column) {
  if (!column) {
    return { nullable: true, maxLength: null, type: '' }
  }
  return {
    nullable: column.nullable === 'YES' || column.nullable === true,
    maxLength: column.length || null,
    type: column.type || ''
  }
}

// ==================== 数据库配置工具函数 ====================
/**
 * 获取所有数据库模板
 * @param {Object} sqlEngine - SQL引擎实例
 * @returns {Array} 数据库模板列表
 */
export function getAllDatabaseTemplates(sqlEngine) {
  try {
    const supportedList = sqlEngine.getSupportedDatabases()
    const templateList = []

    for (const dialect of supportedList) {
      templateList.push({
        value: dialect.type,
        name: dialect.name,
        dialect: dialect.type,
        defaultPort: dialect.defaultPort,
        variants: sqlEngine.getVariants(dialect.type),
        connectionModes: sqlEngine.getDatabaseConfig(dialect.type)?.connectionModes || [],
        namespaceLevels: sqlEngine.getDatabaseConfig(dialect.type)?.namespaceLevels || [],
        runtimeSupport: sqlEngine.getDatabaseConfig(dialect.type)?.runtimeSupport || {},
        capabilities: sqlEngine.getDatabaseConfig(dialect.type)?.capabilities || {}
      })
    }

    return templateList
  } catch {
    return []
  }
}

/**
 * 测试数据库连接
 * @param {Object} params - 连接参数
 * @returns {Promise<Object>} 结构化连接测试结果
 */
export async function testDatabaseConnection({ sessionId, connection, sqlEngine }) {
  if (!connection?.dialect) {
    return {
      success: false,
      failureStage: 'configuration',
      message: '请选择 SQL 方言',
      diagnostics: []
    }
  }
  const params = {
    sessionId,
    connection
  }

  try {
    const response = await sqlEngine.testConnection(params)
    return response?.data || { success: true, diagnostics: [] }
  } catch (error) {
    return (
      error?.connectionTest || {
        success: false,
        failureStage: 'unknown',
        message: error?.message || '数据库连接测试失败',
        diagnostics: []
      }
    )
  }
}

// ==================== 配置字段访问工具函数 ====================
export function getDatabaseConnectionName(row) {
  return row?.connectionName || '未命名连接'
}

export function getDatabaseTestStatus(status) {
  return DATABASE_TEST_STATUS[Number(status)] || DATABASE_TEST_STATUS[0]
}

export function getDatabaseDialect(row) {
  return row?.connection?.dialect || ''
}

export function formatDatabaseConnectionTarget(connection = {}) {
  if (connection.connectionMode === 'custom') {
    return (
      connection.runtimeOptions?.java?.jdbcUrl ||
      connection.runtimeOptions?.php?.dsn ||
      '自定义运行时连接'
    )
  }
  if (connection.dialect === 'sqlite') return connection.file || '-'
  const locator = connection.database || connection.service || connection.sid || ''
  return `${connection.dialect || 'database'}://${connection.host || ''}${connection.port ? `:${connection.port}` : ''}${locator ? `/${locator}` : ''}`
}

export function getDatabaseConnectionTarget(row) {
  return formatDatabaseConnectionTarget(row?.connection)
}

export function getUsername(row) {
  return row?.connection?.username || ''
}

export function getDriverClass(row) {
  const connection = row?.connection || {}
  return (
    connection.runtimeOptions?.java?.driverClass ||
    connection.runtimeOptions?.php?.pdoDriver ||
    (connection.dialect ? '自动适配' : '')
  )
}

/**
 * 获取 SQL 方言的标签类型
 * @param {string} dialect - SQL 方言
 * @returns {string} Element Plus 标签类型
 */
export function getDialectTagType(dialect) {
  return DIALECT_TAG_TYPES[dialect?.toLowerCase()] || 'info'
}

/**
 * 判断状态是否为启用
 * @param {*} status - 状态值
 * @returns {boolean}
 */
export function isStatusEnabled(status) {
  return status === 1
}

// ==================== 数据操作函数 ====================
/**
 * 从行数据构建筛选条件
 * @param {Array} headers - 表头
 * @param {Object} rowData - 具名对象行
 * @returns {Array} 筛选条件
 */
function buildRowFiltersFromRow(headers, rowData) {
  if (!headers || !rowData) {
    return []
  }

  return headers.map((header) => {
    const value = rowData[header]
    if (value === null || value === undefined) {
      return {
        field: header,
        operator: 'is_null'
      }
    }

    return {
      field: header,
      operator: 'eq',
      value
    }
  })
}

/**
 * 从行数据构建 WHERE 条件
 * @param {Array} headers - 表头
 * @param {Object} rowData - 具名对象行
 * @param {Array} columnsMeta - 列元数据
 * @returns {Object} WHERE 条件
 */
export function buildWherePayloadFromRow(headers, rowData, columnsMeta = []) {
  if (!Array.isArray(headers) || !rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
    return null
  }

  const primaryKeyColumns = Array.isArray(columnsMeta)
    ? columnsMeta.filter((column) => column?.primaryKey && column?.name)
    : []

  if (primaryKeyColumns.length > 0) {
    const values = {}
    primaryKeyColumns.forEach((column) => {
      if (headers.includes(column.name)) {
        values[column.name] = rowData[column.name]
      }
    })

    if (Object.keys(values).length === primaryKeyColumns.length) {
      return {
        type: 'pk',
        values
      }
    }
  }

  return {
    filters: buildRowFiltersFromRow(headers, rowData)
  }
}

/**
 * 删除单行数据
 * @param {Object} params - 删除参数
 * @returns {Promise<void>}
 */
export async function deleteRowData({
  sessionId,
  connection,
  objectRef = null,
  where,
  sqlEngine
}) {
  if (!where) {
    throw new Error('删除条件不能为空')
  }

  await sqlEngine.deleteRows({
    sessionId,
    connection,
    objectRef,
    where
  })
}

/**
 * 批量删除多行数据
 * @param {Object} params - 删除参数
 * @returns {Promise<number>} 成功删除的行数
 */
export async function deleteRowsData({
  sessionId,
  connection,
  objectRef = null,
  headers,
  rows,
  sqlEngine,
  columnsMeta = [],
  onProgress
}) {
  if (!rows || rows.length === 0) {
    return 0
  }

  const results = await Promise.allSettled(
    rows.map(async (row, index) => {
      const where = buildWherePayloadFromRow(headers, row, columnsMeta)
      if (!where) {
        return false
      }

      try {
        await deleteRowData({
          sessionId,
          connection,
          objectRef,
          where,
          sqlEngine
        })

        if (onProgress) {
          onProgress(index + 1, rows.length)
        }

        return true
      } catch {
        return false
      }
    })
  )

  return results.filter((r) => r.status === 'fulfilled' && r.value === true).length
}

/**
 * 导出表数据为CSV
 * @param {Object} params - 导出参数
 * @returns {Promise<Object>} 导出任务信息
 */
export async function exportTableData({
  sessionId,
  connection,
  databaseName,
  tableName,
  objectRef = null,
  tableRows = null,
  tableData = null,
  sqlEngine,
  onSuccess,
  onError
}) {
  if (!databaseName || !tableName) {
    onError && onError(new Error('请先选择要导出的表'))
    return
  }

  const rows = Array.isArray(tableRows) ? tableRows : tableData
  if (!Array.isArray(rows) || rows.length === 0) {
    onError && onError(new Error('没有数据可导出'))
    return
  }

  try {
    const response = await sqlEngine.exportTable({
      sessionId,
      connection,
      objectRef,
      format: 'csv'
    })
    const task = response?.data || {}

    if (onSuccess) {
      onSuccess(task)
    }

    return task
  } catch (error) {
    if (onError) {
      onError(error)
    }
  }
}

/**
 * 执行数据库导出
 * @param {Object} params - 导出参数
 * @returns {Promise<Object>} 导出结果
 */
export async function performDatabaseExport({
  sessionId,
  connection,
  objectRef = null,
  tableRefs = null,
  sqlEngine
}) {
  const response = await sqlEngine.exportDatabase({
    sessionId,
    connection,
    objectRef,
    tableRefs,
    includeStructure: true,
    includeData: true,
    format: 'zip'
  })

  return response?.data || {}
}
