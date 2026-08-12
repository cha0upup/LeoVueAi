import { describe, expect, it } from 'vitest'

import { getDatabaseTestStatus } from './database.js'

describe('database connection status', () => {
  it('maps persisted test states to stable UI presentations', () => {
    expect(getDatabaseTestStatus(0)).toEqual({ label: '未检测', type: 'info' })
    expect(getDatabaseTestStatus(1)).toEqual({ label: '连接正常', type: 'success' })
    expect(getDatabaseTestStatus(2)).toEqual({ label: '连接异常', type: 'danger' })
    expect(getDatabaseTestStatus(null)).toEqual({ label: '未检测', type: 'info' })
  })
})
