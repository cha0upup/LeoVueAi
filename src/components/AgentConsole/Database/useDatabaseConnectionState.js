import { computed, getCurrentScope, onScopeDispose, reactive, ref } from 'vue'

export const DATABASE_CONNECTION_STATUS = Object.freeze({
  IDLE: 'idle',
  CONNECTING: 'connecting',
  READY: 'ready',
  ERROR: 'error'
})

const DATABASE_CONNECTION_PRESENTATION = Object.freeze({
  [DATABASE_CONNECTION_STATUS.IDLE]: Object.freeze({ label: '待连接', type: 'info' }),
  [DATABASE_CONNECTION_STATUS.CONNECTING]: Object.freeze({ label: '连接中', type: 'warning' }),
  [DATABASE_CONNECTION_STATUS.READY]: Object.freeze({ label: '已连接', type: 'success' }),
  [DATABASE_CONNECTION_STATUS.ERROR]: Object.freeze({ label: '连接失败', type: 'danger' })
})

export const getDatabaseConnectionStatusPresentation = (status) =>
  DATABASE_CONNECTION_PRESENTATION[status] || DATABASE_CONNECTION_PRESENTATION.idle

export const isDatabaseConnectionConfigured = (connection = {}) => {
  if (!connection.dialect) return false
  return Boolean(
    connection.connectionId ||
      connection.host ||
      connection.file ||
      connection.database ||
      connection.service ||
      connection.sid ||
      connection.runtimeOptions?.java?.jdbcUrl ||
      connection.runtimeOptions?.php?.dsn
  )
}

export const useDatabaseConnectionState = ({ sessionId, connection, sqlEngine }) => {
  const status = ref(DATABASE_CONNECTION_STATUS.IDLE)
  const error = ref('')
  const details = reactive({
    user: '',
    databaseVersion: '',
    driverVersion: ''
  })
  let activeController = null
  let requestVersion = 0

  const configured = computed(() => isDatabaseConnectionConfigured(connection))
  const ready = computed(() => status.value === DATABASE_CONNECTION_STATUS.READY)

  const cancel = () => {
    requestVersion += 1
    activeController?.abort()
    activeController = null
  }

  const reset = () => {
    cancel()
    status.value = DATABASE_CONNECTION_STATUS.IDLE
    error.value = ''
    Object.assign(details, {
      user: connection.username || '',
      databaseVersion: '',
      driverVersion: ''
    })
  }

  const connect = async () => {
    cancel()
    error.value = ''
    Object.assign(details, {
      user: connection.username || '',
      databaseVersion: '',
      driverVersion: ''
    })

    if (!configured.value) {
      status.value = DATABASE_CONNECTION_STATUS.IDLE
      return false
    }

    const controller = new AbortController()
    const currentVersion = ++requestVersion
    activeController = controller
    status.value = DATABASE_CONNECTION_STATUS.CONNECTING

    try {
      const response = await sqlEngine.testConnection({
        sessionId,
        connection,
        signal: controller.signal
      })
      if (currentVersion !== requestVersion) return false

      const result = response?.data || {}
      Object.assign(details, {
        user: result.user || connection.username || '',
        databaseVersion: result.databaseVersion || '',
        driverVersion: result.driverVersion || ''
      })
      status.value = DATABASE_CONNECTION_STATUS.READY
      return true
    } catch (cause) {
      if (currentVersion !== requestVersion || controller.signal.aborted) return false
      error.value =
        cause?.response?.data?.msg ||
        cause?.response?.data?.message ||
        cause?.message ||
        '数据库连接失败'
      status.value = DATABASE_CONNECTION_STATUS.ERROR
      return false
    } finally {
      if (activeController === controller) activeController = null
    }
  }

  if (getCurrentScope()) onScopeDispose(cancel)

  return {
    status,
    error,
    details,
    ready,
    connect,
    reset,
    cancel
  }
}
