import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../http.js', () => ({ default: { post: vi.fn() } }))
import http from '../http.js'
import { getWorkspaceAgentChildrenApi } from './projects.js'

describe('getWorkspaceAgentChildrenApi', () => {
  beforeEach(() => vi.clearAllMocks())
  it.each([
    ['', '/platform/agent-manage/children'],
    ['project/1', '/platform/projects/project%2F1/children']
  ])('routes project %j children to %s', (projectId, endpoint) => {
    getWorkspaceAgentChildrenApi(projectId, 'parent-1')
    expect(http.post).toHaveBeenCalledExactlyOnceWith(endpoint, {
      parentAgentId: 'parent-1'
    })
  })
})
