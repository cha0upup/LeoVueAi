import { expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  createTerminalReadBatcher: vi.fn(() => vi.fn())
}))

vi.mock('../http.js', () => ({ default: { get: mocks.get, post: mocks.post } }))
vi.mock('../terminalReadBatcher.js', () => ({
  createTerminalReadBatcher: mocks.createTerminalReadBatcher
}))

it('initializes terminal state only when the node API is loaded', async () => {
  const { loginApi } = await import('./auth.js')
  const { listAvailableAiModelsApi } = await import('./platform-ai.js')
  const credentials = { username: 'fixture', password: 'fixture' }
  loginApi(credentials)
  listAvailableAiModelsApi()

  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/platform/user/login', credentials)
  expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/platform/ai/models')
  expect(mocks.createTerminalReadBatcher).not.toHaveBeenCalled()

  await import('./agent-node.js')
  expect(mocks.createTerminalReadBatcher).toHaveBeenCalledOnce()
  expect(mocks.get).toHaveBeenCalledOnce()
  expect(mocks.post).toHaveBeenCalledOnce()
})
