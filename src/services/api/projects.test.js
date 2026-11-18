import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../http.js', () => ({ default: { post: vi.fn() } }))
import http from '../http.js'
import { attachProjectAgentsApi, getWorkspaceAgentChildrenApi, transferProjectApi } from './projects.js'

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

it('posts project ownership transfers with only the project and recipient IDs', () => {
  http.post.mockClear()
  transferProjectApi('project-1', 'next-owner')
  expect(http.post).toHaveBeenCalledExactlyOnceWith('/platform/projects/transfer', {
    projectId: 'project-1', newOwnerUserId: 'next-owner'
  })
})

it('posts project assignments with only the project and host IDs', () => {
  http.post.mockClear()
  attachProjectAgentsApi('project-1', ['host-1'])
  expect(http.post).toHaveBeenCalledExactlyOnceWith('/platform/projects/hosts/attach', {
    projectId: 'project-1', agentIds: ['host-1']
  })
})
