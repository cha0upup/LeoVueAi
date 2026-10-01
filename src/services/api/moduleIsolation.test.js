import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  createTerminalReadBatcher: vi.fn(() => vi.fn())
}))

vi.mock('../http.js', () => ({ default: { get: mocks.get, post: mocks.post } }))
vi.mock('../terminalReadBatcher.js', () => ({
  createTerminalReadBatcher: mocks.createTerminalReadBatcher
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('business API module boundaries', () => {
  it('loads login APIs without initializing unrelated terminal state', async () => {
    const { loginApi } = await import('./auth.js')
    const credentials = { username: 'fixture', password: 'fixture' }
    loginApi(credentials)

    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/platform/user/login', credentials)
    expect(mocks.createTerminalReadBatcher).not.toHaveBeenCalled()
  })

  it('loads the platform model catalog without initializing node APIs', async () => {
    const { listAvailableAiModelsApi } = await import('./platform-ai.js')
    listAvailableAiModelsApi()

    expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/platform/ai/models')
    expect(mocks.createTerminalReadBatcher).not.toHaveBeenCalled()
  })

  it('initializes the terminal batcher only when its own node API is loaded', async () => {
    await import('./puppet-node.js')

    expect(mocks.createTerminalReadBatcher).toHaveBeenCalledTimes(1)
    expect(mocks.post).not.toHaveBeenCalled()
  })
})
