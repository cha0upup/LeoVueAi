import { reactive, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  testSqlConnectionApi: vi.fn(),
  getSqlRuntimeCapabilitiesApi: vi.fn(),
  getSqlDialectsApi: vi.fn(),
  getSqlDatabasesApi: vi.fn(),
  getSqlTablesApi: vi.fn(),
  getSqlTableColumnsApi: vi.fn(),
  querySqlTableApi: vi.fn(),
  executeSqlQueryApi: vi.fn()
}))

vi.mock('@/services/api.js', () => apiMocks)

const { default: sqlEngine } = await import('./SqlEngine.js')
const {
  buildDatabaseConnection,
  createDatabaseConfigForm,
  useDatabaseConfigDialogBase,
  verifySavedDatabaseConnection
} = await import('./database-config-dialog-shared.js')

afterEach(() => {
  sqlEngine.clearDialectCatalog()
  vi.restoreAllMocks()
})

describe('SqlEngine runtime-neutral connections', () => {
  it('passes abort signals as request config instead of serializing them', async () => {
    const controller = new AbortController()
    apiMocks.querySqlTableApi.mockResolvedValueOnce({ data: { rows: [] } })

    await sqlEngine.queryTable({
      sessionId: 'session-1',
      connection: { dialect: 'sqlite', connectionMode: 'standard', file: ':memory:' },
      objectRef: { catalog: 'main', name: 'events', kind: 'table' },
      queryTimeoutSeconds: 45,
      signal: controller.signal
    })

    expect(apiMocks.querySqlTableApi).toHaveBeenCalledWith(
      expect.not.objectContaining({ signal: expect.anything() }),
      { signal: controller.signal }
    )
    expect(apiMocks.querySqlTableApi.mock.calls[0][0]).toMatchObject({
      sessionId: 'session-1',
      queryTimeoutSeconds: 45
    })
  })

  it('passes abort signals to metadata requests', async () => {
    const controller = new AbortController()
    apiMocks.getSqlDatabasesApi.mockResolvedValueOnce({ data: { databases: [] } })
    apiMocks.getSqlTablesApi.mockResolvedValueOnce({ data: { tables: [] } })

    const params = {
      sessionId: 'session-1',
      connection: { dialect: 'sqlite', file: ':memory:' },
      signal: controller.signal
    }
    await sqlEngine.getDatabases(params)
    const objectRef = { catalog: 'main', kind: 'catalog' }
    await sqlEngine.getTables({ ...params, objectRef })

    expect(apiMocks.getSqlDatabasesApi).toHaveBeenCalledWith(
      expect.not.objectContaining({ signal: expect.anything() }),
      { signal: controller.signal }
    )
    expect(apiMocks.getSqlTablesApi).toHaveBeenCalledWith(
      expect.objectContaining({ objectRef }),
      { signal: controller.signal }
    )
  })

  it('passes abort signals to connection tests', async () => {
    const controller = new AbortController()
    apiMocks.testSqlConnectionApi.mockResolvedValueOnce({ data: { success: true } })

    await sqlEngine.testConnection({
      sessionId: 'session-1',
      connection: { dialect: 'sqlite', file: ':memory:' },
      signal: controller.signal
    })

    expect(apiMocks.testSqlConnectionApi).toHaveBeenCalledWith(
      expect.not.objectContaining({ signal: expect.anything() }),
      { signal: controller.signal }
    )
  })

  it('builds a canonical connection payload without JDBC or PDO fields', () => {
    const payload = sqlEngine._buildConnectionPayload({
      dialect: 'mysql',
      connectionMode: 'standard',
      variant: 'default',
      host: 'db.internal',
      port: 3307,
      database: 'inventory',
      connectionId: 'connection-1',
      username: 'app',
      password: 'secret',
      options: { charset: 'utf8mb4' },
      dialectOptions: { testSql: 'VALUES 1' }
    })

    expect(payload).toMatchObject({
      dialect: 'mysql',
      connectionMode: 'standard',
      variant: 'default',
      host: 'db.internal',
      port: 3307,
      database: 'inventory',
      connectionId: 'connection-1',
      username: 'app',
      dialectOptions: { testSql: 'VALUES 1' }
    })
    expect(payload).not.toHaveProperty('url')
    expect(payload).not.toHaveProperty('driver')
    expect(payload).not.toHaveProperty('dsn')
  })

  it('refreshes templates from the backend dialect registry', async () => {
    apiMocks.getSqlDialectsApi.mockResolvedValueOnce({
      data: [
        {
          type: 'vendorx',
          name: 'Vendor X',
          defaultPort: 9527,
          aliases: ['vx'],
          connectionModes: ['standard', 'custom'],
          variants: [
            {
              key: 'default',
              name: 'Vendor X',
              fields: ['host', 'port', 'database', 'username', 'password']
            }
          ],
          capabilities: { structuredQuery: true },
          runtimeSupport: { java: true, php: false },
          dataTypes: [
            {
              type: 'VARCHAR',
              defaultLength: 128,
              defaultPrecision: null,
              defaultScale: null
            },
            {
              type: 'DECIMAL',
              defaultLength: null,
              defaultPrecision: 12,
              defaultScale: 3
            }
          ]
        },
        {
          type: 'generic',
          name: 'Generic SQL',
          defaultPort: null,
          aliases: [],
          connectionModes: ['custom'],
          variants: [
            {
              key: 'custom',
              name: '自定义运行时连接',
              fields: ['username', 'password', 'runtimeOptions']
            }
          ],
          capabilities: { structuredQuery: false }
        }
      ]
    })

    expect(await sqlEngine.refreshDialectCatalog()).toBe(true)
    expect(sqlEngine.getSupportedDatabases()).toEqual([
      { type: 'vendorx', name: 'Vendor X', defaultPort: 9527 },
      { type: 'generic', name: 'Generic SQL', defaultPort: null }
    ])
    expect(sqlEngine.normalizeDialect('vx')).toBe('vendorx')
    expect(sqlEngine.normalizeDialect('invented')).toBe('')
    expect(sqlEngine.getDatabaseConfig('vendorx')).toMatchObject({
      name: 'Vendor X',
      capabilities: { structuredQuery: true },
      runtimeSupport: { java: true, php: false }
    })
    expect(sqlEngine.getDialectName('vx')).toBe('Vendor X')
    expect(sqlEngine.getDataTypeOptions('vendorx')).toEqual([
      { value: 'VARCHAR', label: 'VARCHAR' },
      { value: 'DECIMAL', label: 'DECIMAL' }
    ])
    expect(sqlEngine.getDataTypeDefaults('vendorx', 'VARCHAR')).toMatchObject({
      hasLength: true,
      defaultLength: 128,
      placeholder: '128'
    })
    expect(sqlEngine.getDataTypeDefaults('vendorx', 'DECIMAL')).toMatchObject({
      hasPrecision: true,
      hasScale: true,
      defaultPrecision: 12,
      defaultScale: 3,
      placeholder: '12,3'
    })
  })

  it('starts without a local dialect catalog and exposes templates only after loading', async () => {
    expect(sqlEngine.getSupportedDatabases()).toEqual([])
    apiMocks.getSqlDialectsApi.mockResolvedValueOnce({
      data: [
        {
          type: 'dm',
          name: '达梦 DM',
          defaultPort: 5236,
          aliases: ['dameng'],
          connectionModes: ['standard', 'custom'],
          variants: [{ key: 'default', name: '达梦 DM', fields: ['host', 'port'] }],
          runtimeSupport: { java: true, php: false },
          dataTypes: [{ type: 'VARCHAR2', defaultLength: 255 }]
        },
        {
          type: 'kingbasees',
          name: '人大金仓 KingbaseES',
          defaultPort: 54321,
          aliases: ['kingbase', 'kes'],
          connectionModes: ['standard', 'custom'],
          variants: [{ key: 'default', name: 'KingbaseES', fields: ['host', 'port'] }],
          runtimeSupport: { java: true, php: false },
          dataTypes: [{ type: 'VARCHAR', defaultLength: 255 }]
        }
      ]
    })
    const templates = ref([])
    const dialog = useDatabaseConfigDialogBase({
      form: reactive(createDatabaseConfigForm()),
      templates,
      sessionId: 'session-1'
    })

    expect(await dialog.loadDatabaseTemplates()).toHaveLength(2)
    expect(dialog.dialectCatalogError.value).toBe('')
    expect(sqlEngine.normalizeDialect('dameng')).toBe('dm')
    expect(sqlEngine.normalizeDialect('kes')).toBe('kingbasees')
    expect(templates.value).toEqual([
      expect.objectContaining({
        value: 'dm',
        name: '达梦 DM',
        defaultPort: 5236,
        runtimeSupport: { java: true, php: false }
      }),
      expect.objectContaining({
        value: 'kingbasees',
        name: '人大金仓 KingbaseES',
        defaultPort: 54321,
        runtimeSupport: { java: true, php: false }
      })
    ])
  })

  it('blocks unsupported standard runtimes before saving domestic connections', async () => {
    const form = reactive(createDatabaseConfigForm())
    Object.assign(form, {
      dialect: 'dm',
      connectionMode: 'standard',
      host: 'dm.internal',
      port: 5236,
      database: 'APP'
    })
    const templates = ref([
      {
        value: 'dm',
        defaultPort: 5236,
        variants: sqlEngine.getVariants('dm'),
        runtimeSupport: { java: true, php: false }
      }
    ])
    const getCapabilities = vi.spyOn(sqlEngine, 'getRuntimeCapabilities').mockResolvedValue({
      data: { code: 200, runtime: 'php', provider: 'pdo', available: true }
    })
    const dialog = useDatabaseConfigDialogBase({ form, templates, sessionId: 'session-1' })

    await dialog.inspectRuntimeCapabilities()

    expect(dialog.isComplete.value).toBe(false)
    getCapabilities.mockRestore()
  })

  it('clears the dialect catalog and blocks saving when the registry is unavailable', async () => {
    sqlEngine.applyDialectCatalog([
      {
        type: 'mysql',
        name: 'MySQL',
        aliases: [],
        variants: [{ key: 'default', name: 'MySQL', fields: ['host', 'port'] }]
      }
    ])
    apiMocks.getSqlDialectsApi.mockRejectedValueOnce(new Error('方言目录服务不可用'))
    const form = reactive(createDatabaseConfigForm())
    Object.assign(form, { dialect: 'mysql', host: 'db.internal', port: 3306 })
    const templates = ref([{ value: 'mysql' }])
    const dialog = useDatabaseConfigDialogBase({ form, templates, sessionId: 'session-1' })

    expect(await dialog.loadDatabaseTemplates()).toEqual([])
    expect(dialog.dialectCatalogError.value).toBe('方言目录服务不可用')
    expect(sqlEngine.getSupportedDatabases()).toEqual([])
    expect(templates.value).toEqual([])
    expect(dialog.isComplete.value).toBe(false)
  })

  it('exposes semantic variants instead of runtime driver variants', () => {
    sqlEngine.applyDialectCatalog([
      {
        type: 'oracle',
        name: 'Oracle',
        defaultPort: 1521,
        aliases: [],
        connectionModes: ['standard', 'custom'],
        variants: [
          {
            key: 'service',
            name: 'Service Name',
            fields: ['host', 'port', 'service', 'username', 'password', 'options']
          },
          {
            key: 'sid',
            name: 'SID',
            fields: ['host', 'port', 'sid', 'username', 'password', 'options']
          }
        ]
      }
    ])
    expect(sqlEngine.getVariants('oracle')).toEqual([
      {
        key: 'service',
        name: 'Service Name',
        fields: ['host', 'port', 'service', 'username', 'password', 'options']
      },
      {
        key: 'sid',
        name: 'SID',
        fields: ['host', 'port', 'sid', 'username', 'password', 'options']
      }
    ])
  })

  it('keeps Java and PHP advanced runtime overrides isolated', () => {
    const form = createDatabaseConfigForm()
    Object.assign(form, {
      dialect: 'mysql',
      connectionMode: 'custom'
    })
    Object.assign(form.runtimeOptions.java, {
      jdbcUrl: ' jdbc:mysql://proxy.internal:3306/inventory ',
      driverClass: ' custom.Driver ',
      propertiesText: '{"sslMode":"verify-full"}'
    })
    Object.assign(form.runtimeOptions.php, {
      dsn: ' mysql:host=proxy.internal;dbname=inventory ',
      pdoDriver: ' mysql '
    })

    const connection = buildDatabaseConnection(form)

    expect(connection.runtimeOptions).toEqual({
      java: {
        jdbcUrl: 'jdbc:mysql://proxy.internal:3306/inventory',
        driverClass: 'custom.Driver',
        connectionProperties: { sslMode: 'verify-full' }
      },
      php: {
        dsn: 'mysql:host=proxy.internal;dbname=inventory',
        pdoDriver: 'mysql'
      }
    })
    expect(connection).not.toHaveProperty('jdbcUrl')
    expect(connection).not.toHaveProperty('dsn')
    expect(connection).not.toHaveProperty('scope')
    expect(connection.connectionMode).toBe('custom')
  })

  it('can omit an unchanged empty password from edit payloads', () => {
    const form = createDatabaseConfigForm()
    Object.assign(form, {
      dialect: 'mysql',
      connectionMode: 'standard',
      host: 'db.internal',
      port: 3306,
      password: ''
    })

    const editConnection = buildDatabaseConnection(form, { omitEmptyPassword: true })
    const createConnection = buildDatabaseConnection(form)

    expect(editConnection).not.toHaveProperty('password')
    expect(createConnection).toHaveProperty('password', '')
  })

  it('keeps Generic SQL health checks separate from driver properties', () => {
    const form = createDatabaseConfigForm()
    Object.assign(form, {
      dialect: 'generic',
      connectionMode: 'custom',
      testSql: ' VALUES 1 '
    })
    Object.assign(form.runtimeOptions.java, {
      jdbcUrl: 'jdbc:vendor:test',
      driverClass: 'com.vendor.Driver'
    })

    const connection = buildDatabaseConnection(form)

    expect(connection.dialectOptions).toEqual({ testSql: 'VALUES 1' })
    expect(connection.options).toEqual({})
    expect(connection.runtimeOptions.java.connectionProperties).toEqual({})
  })

  it('rechecks a saved connection through its runtime-neutral identifier', async () => {
    const testConnection = vi.spyOn(sqlEngine, 'testConnection').mockResolvedValue({ data: {} })

    await verifySavedDatabaseConnection({
      sessionId: 'session-1',
      response: { data: { connectionId: 'connection-1' } }
    })

    expect(testConnection).toHaveBeenCalledWith({
      sessionId: 'session-1',
      connection: { connectionId: 'connection-1' }
    })
    testConnection.mockRestore()
  })

  it('does not recheck a saved connection while it is disabled', async () => {
    const testConnection = vi.spyOn(sqlEngine, 'testConnection').mockResolvedValue({ data: {} })

    const result = await verifySavedDatabaseConnection({
      sessionId: 'session-1',
      response: { data: { connectionId: 'connection-1', status: 0 } }
    })

    expect(result).toBeNull()
    expect(testConnection).not.toHaveBeenCalled()
    testConnection.mockRestore()
  })

  it('rejects a structured backend connection failure instead of treating HTTP 200 as success', async () => {
    apiMocks.testSqlConnectionApi.mockResolvedValueOnce({
      data: {
        success: false,
        failureStage: 'authentication',
        errorCategory: 'AUTHENTICATION_FAILED',
        message: 'invalid credentials',
        diagnostics: []
      }
    })

    await expect(
      sqlEngine.testConnection({
        sessionId: 'session-1',
        connection: {
          dialect: 'mysql',
          connectionMode: 'standard',
          host: 'db.internal',
          port: 3306
        }
      })
    ).rejects.toMatchObject({
      message: 'invalid credentials',
      connectionTest: {
        success: false,
        failureStage: 'authentication'
      }
    })
  })

  it('probes runtime capabilities with the canonical connection payload', async () => {
    apiMocks.getSqlRuntimeCapabilitiesApi.mockResolvedValueOnce({
      data: { code: 200, runtime: 'php', provider: 'pdo', available: true }
    })

    const response = await sqlEngine.getRuntimeCapabilities({
      sessionId: 'session-1',
      connection: { dialect: 'postgresql', connectionMode: 'standard', host: 'db.internal' }
    })

    expect(response.data.runtime).toBe('php')
    expect(apiMocks.getSqlRuntimeCapabilitiesApi).toHaveBeenCalledWith({
      sessionId: 'session-1',
      connection: expect.objectContaining({
        dialect: 'postgresql',
        connectionMode: 'standard',
        host: 'db.internal'
      })
    })
  })

  it('validates custom connection fields against the detected Puppet runtime', async () => {
    const form = reactive(createDatabaseConfigForm())
    Object.assign(form, { dialect: 'generic', connectionMode: 'custom' })
    Object.assign(form.runtimeOptions.java, {
      jdbcUrl: 'jdbc:vendor:test',
      driverClass: 'com.vendor.Driver'
    })
    const getCapabilities = vi.spyOn(sqlEngine, 'getRuntimeCapabilities').mockResolvedValue({
      data: { code: 200, runtime: 'php', provider: 'pdo', available: true }
    })
    const dialog = useDatabaseConfigDialogBase({
      form,
      templates: ref([
        {
          value: 'generic',
          variants: [{ key: 'custom', name: '自定义运行时连接', fields: ['runtimeOptions'] }],
          runtimeSupport: { java: true, php: true }
        }
      ]),
      sessionId: 'session-1'
    })

    await dialog.inspectRuntimeCapabilities()
    expect(dialog.isComplete.value).toBe(false)

    Object.assign(form.runtimeOptions.php, {
      dsn: 'vendor:host=db.internal',
      pdoDriver: 'vendor'
    })
    expect(dialog.isComplete.value).toBe(true)
    getCapabilities.mockRestore()
  })
})
