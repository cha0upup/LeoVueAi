import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import {
  DATABASE_CONNECTION_STATUS,
  getDatabaseConnectionStatusPresentation,
  isDatabaseConnectionConfigured,
  useDatabaseConnectionState
} from './useDatabaseConnectionState.js'

describe('useDatabaseConnectionState', () => {
  it('recognizes saved and runtime connection configurations', () => {
    expect(isDatabaseConnectionConfigured({ dialect: 'mysql', connectionId: 'c1' })).toBe(true)
    expect(
      isDatabaseConnectionConfigured({
        dialect: 'oracle',
        runtimeOptions: { java: { jdbcUrl: 'jdbc:oracle:thin:@db' } }
      })
    ).toBe(true)
    expect(isDatabaseConnectionConfigured({ dialect: 'mysql' })).toBe(false)
    expect(isDatabaseConnectionConfigured({ host: 'db' })).toBe(false)
  })

  it('provides one presentation mapping for every connection state', () => {
    expect(getDatabaseConnectionStatusPresentation('ready')).toEqual({
      label: '已连接',
      type: 'success'
    })
    expect(getDatabaseConnectionStatusPresentation('unknown')).toEqual({
      label: '待连接',
      type: 'info'
    })
  })

  it('moves from connecting to ready and records connection details', async () => {
    let resolveRequest
    const sqlEngine = {
      testConnection: vi.fn(
        () => new Promise((resolve) => {
          resolveRequest = resolve
        })
      )
    }
    const connection = reactive({
      connectionId: 'c1',
      dialect: 'dm',
      username: 'APP'
    })
    const state = useDatabaseConnectionState({ sessionId: 's1', connection, sqlEngine })

    const request = state.connect()
    expect(state.status.value).toBe(DATABASE_CONNECTION_STATUS.CONNECTING)
    resolveRequest({ data: { databaseVersion: 'DM8', driverVersion: '8.1' } })

    await expect(request).resolves.toBe(true)
    expect(state.status.value).toBe(DATABASE_CONNECTION_STATUS.READY)
    expect(state.details.databaseVersion).toBe('DM8')
    expect(state.details.driverVersion).toBe('8.1')
    expect(state.details.user).toBe('APP')
  })

  it('records a failed connection and supports retry', async () => {
    const sqlEngine = {
      testConnection: vi
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ data: { databaseVersion: '16' } })
    }
    const connection = reactive({ connectionId: 'c1', dialect: 'postgresql' })
    const state = useDatabaseConnectionState({ sessionId: 's1', connection, sqlEngine })

    await expect(state.connect()).resolves.toBe(false)
    expect(state.status.value).toBe(DATABASE_CONNECTION_STATUS.ERROR)
    expect(state.error.value).toBe('network error')

    await expect(state.connect()).resolves.toBe(true)
    expect(state.status.value).toBe(DATABASE_CONNECTION_STATUS.READY)
    expect(state.error.value).toBe('')
  })
})
