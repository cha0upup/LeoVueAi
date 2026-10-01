import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}))

vi.mock('../http.js', () => ({
  default: {
    get: mocks.get,
    post: mocks.post
  }
}))

import { getWorkspaceAgentChildrenApi } from './projects.js'

describe('getWorkspaceAgentChildrenApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the global children endpoint when no project is active', () => {
    getWorkspaceAgentChildrenApi('', 'parent-1')

    expect(mocks.post).toHaveBeenCalledWith('/platform/agent-manage/children', {
      parentAgentId: 'parent-1'
    })
  })

  it('uses the project endpoint when a project is active', () => {
    getWorkspaceAgentChildrenApi('project/1', 'parent-1')

    expect(mocks.post).toHaveBeenCalledWith('/platform/projects/project%2F1/children', {
      parentAgentId: 'parent-1'
    })
  })
})
